using DolarEnVivo.Application.Interfaces;
using DolarEnVivo.Infrastructure.ExternalApis;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace DolarEnVivo.Infrastructure.Services;

public class RatesFetcherService : IRateRefreshService
{
    // Buffer past the dashboard's longest range (90 days).
    private const int RetentionDays = 100;

    /// <summary>How old stored rates may get before a read triggers a refresh.</summary>
    public static readonly TimeSpan DefaultMaxAge = TimeSpan.FromMinutes(15);

    // A request must never hang on a slow provider, so the inline path gets a much
    // tighter budget than the background job.
    private static readonly TimeSpan InlineTimeout = TimeSpan.FromSeconds(12);
    private static readonly TimeSpan JobTimeout = TimeSpan.FromSeconds(30);

    // After a failed attempt, stop hammering a provider that is clearly down.
    private static readonly TimeSpan FailureCooldown = TimeSpan.FromMinutes(2);
    private const string CooldownKey = "rates:refresh-cooldown";

    // Collapses concurrent refreshes into one upstream call. Instance state is useless
    // here because the service is scoped, and a second instance would only mean one
    // redundant fetch anyway.
    private static readonly SemaphoreSlim RefreshGate = new(1, 1);
    private static readonly TimeSpan GateWait = TimeSpan.FromSeconds(3);

    private readonly DolarApiClient dolarApiClient;
    private readonly CoinGeckoClient coinGeckoClient;
    private readonly IRateRepository rateRepository;
    private readonly IMemoryCache cache;
    private readonly ILogger<RatesFetcherService> logger;

    public RatesFetcherService(
        DolarApiClient dolarApiClient,
        CoinGeckoClient coinGeckoClient,
        IRateRepository rateRepository,
        IMemoryCache cache,
        ILogger<RatesFetcherService> logger
    )
    {
        ArgumentNullException.ThrowIfNull(dolarApiClient, nameof(dolarApiClient));
        ArgumentNullException.ThrowIfNull(coinGeckoClient, nameof(coinGeckoClient));
        ArgumentNullException.ThrowIfNull(rateRepository, nameof(rateRepository));
        ArgumentNullException.ThrowIfNull(cache, nameof(cache));
        ArgumentNullException.ThrowIfNull(logger, nameof(logger));
        this.dolarApiClient = dolarApiClient;
        this.coinGeckoClient = coinGeckoClient;
        this.rateRepository = rateRepository;
        this.cache = cache;
        this.logger = logger;
    }

    /// <summary>
    /// Hangfire entry point. Kept parameterless because Hangfire serializes the call.
    /// </summary>
    public async Task FetchAndStoreAllRatesAsync()
    {
        using var cts = new CancellationTokenSource(JobTimeout);
        await this.FetchAndStoreAsync(cts.Token);
    }

    public async Task<RateRefreshResult> EnsureFreshAsync(
        TimeSpan maxAge,
        CancellationToken cancellationToken
    )
    {
        DateTime? latest;

        try
        {
            latest = await this.rateRepository.GetLatestRateTimestampAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            this.logger.LogError(ex, "Could not read the latest rate timestamp.");
            return new RateRefreshResult { Reason = "timestamp-unavailable" };
        }

        if (IsFresh(latest, maxAge))
            return new RateRefreshResult { LatestRateAt = latest, Reason = "fresh" };

        if (this.cache.TryGetValue(CooldownKey, out _))
            return new RateRefreshResult { LatestRateAt = latest, Reason = "cooldown" };

        // No caller token here: the wait is already bounded, and letting a disconnect throw
        // would break this method's promise never to fault the read path.
        if (!await RefreshGate.WaitAsync(GateWait))
            return new RateRefreshResult { LatestRateAt = latest, Reason = "refresh-in-progress" };

        try
        {
            // Another caller may have refreshed while we waited on the gate.
            latest = await this.rateRepository.GetLatestRateTimestampAsync(cancellationToken);
            if (IsFresh(latest, maxAge))
                return new RateRefreshResult { LatestRateAt = latest, Reason = "fresh" };

            // Deliberately detached from the caller's token: a browser that walks away
            // mid-request must not abort the write between the exchange and crypto saves.
            using var cts = new CancellationTokenSource(InlineTimeout);
            await this.FetchAndStoreAsync(cts.Token);

            // The fetch already succeeded, so reporting it must not fail on a stale token.
            latest = await this.rateRepository.GetLatestRateTimestampAsync(CancellationToken.None);
            this.logger.LogInformation(
                "Refreshed stale rates on demand. Latest is {Latest}.",
                latest
            );
            return new RateRefreshResult
            {
                Refreshed = true,
                LatestRateAt = latest,
                Reason = "refreshed",
            };
        }
        catch (Exception ex)
        {
            this.cache.Set(CooldownKey, true, FailureCooldown);
            this.logger.LogError(ex, "On-demand rate refresh failed. Serving stored rates.");
            return new RateRefreshResult { LatestRateAt = latest, Reason = "refresh-failed" };
        }
        finally
        {
            RefreshGate.Release();
        }
    }

    public async Task CleanupOldRatesAsync()
    {
        using var cts = new CancellationTokenSource(JobTimeout);
        var cutoff = DateTime.UtcNow.AddDays(-RetentionDays);
        await this.rateRepository.DeleteRatesOlderThanAsync(cutoff, cts.Token);
    }

    private static bool IsFresh(DateTime? latest, TimeSpan maxAge) =>
        latest is not null && DateTime.UtcNow - latest.Value < maxAge;

    private async Task FetchAndStoreAsync(CancellationToken cancellationToken)
    {
        var exchangeRates = (
            await this.dolarApiClient.FetchAllRatesAsync(cancellationToken)
        ).ToList();

        // The client swallows its own failures, so an empty list is the only signal that
        // the fetch did not work. Surfacing it keeps a silent no-op from looking like success.
        if (exchangeRates.Count == 0)
            throw new InvalidOperationException(
                "DolarAPI returned no exchange rates; nothing was stored."
            );

        await this.rateRepository.AddExchangeRatesAsync(exchangeRates, cancellationToken);

        var blueRate = exchangeRates.FirstOrDefault(r => r.Type == "blue")?.Sell ?? 0m;
        if (blueRate <= 0)
        {
            // Crypto is stored in ARS at the blue rate; without it the peso figures would
            // be fiction, and wrong numbers are worse than a gap in the series.
            this.logger.LogWarning("No blue rate in this fetch; skipping crypto prices.");
            return;
        }

        var cryptoRates = (
            await this.coinGeckoClient.FetchRatesAsync(blueRate, cancellationToken)
        ).ToList();

        if (cryptoRates.Count > 0)
            await this.rateRepository.AddCryptoRatesAsync(cryptoRates, cancellationToken);
        else
            this.logger.LogWarning("CoinGecko returned no crypto prices for this fetch.");
    }
}
