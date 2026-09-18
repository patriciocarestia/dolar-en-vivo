using DolarEnVivo.Domain.Entities;
using DolarEnVivo.Infrastructure.Data;
using DolarEnVivo.Infrastructure.ExternalApis;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace DolarEnVivo.Infrastructure.Services;

/// <summary>
/// Fills every day in the chart window that has no stored rate with that day's close.
/// Runs on every startup: an empty database gets its full history, and a day lost while
/// the host had the app unloaded is recovered the next time it wakes. When nothing is
/// missing it costs one query per table and no network calls.
/// </summary>
public class HistoricalDataSeeder
{
    // The dashboard's longest range.
    private const int WindowDays = 90;

    private static readonly (string ApiPath, string DbType)[] DollarTypes =
    [
        ("oficial", "oficial"),
        ("blue", "blue"),
        ("bolsa", "mep"),
        ("contadoconliqui", "ccl"),
        ("cripto", "cripto"),
    ];

    private static readonly (string CoinId, string Symbol)[] Coins =
    [
        ("bitcoin", "BTC"),
        ("ethereum", "ETH"),
    ];

    // CoinGecko's free tier rejects back-to-back calls.
    private static readonly TimeSpan CoinGeckoSpacing = TimeSpan.FromSeconds(3);

    private readonly AppDbContext context;
    private readonly DolarApiClient dolarApiClient;
    private readonly CoinGeckoClient coinGeckoClient;
    private readonly ILogger<HistoricalDataSeeder> logger;

    public HistoricalDataSeeder(
        AppDbContext context,
        DolarApiClient dolarApiClient,
        CoinGeckoClient coinGeckoClient,
        ILogger<HistoricalDataSeeder> logger
    )
    {
        ArgumentNullException.ThrowIfNull(context, nameof(context));
        ArgumentNullException.ThrowIfNull(dolarApiClient, nameof(dolarApiClient));
        ArgumentNullException.ThrowIfNull(coinGeckoClient, nameof(coinGeckoClient));
        ArgumentNullException.ThrowIfNull(logger, nameof(logger));
        this.context = context;
        this.dolarApiClient = dolarApiClient;
        this.coinGeckoClient = coinGeckoClient;
        this.logger = logger;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromMinutes(2));

        // Today is left to the live fetch: the daily sources may not have closed it yet.
        var today = DateTime.UtcNow.Date;
        var since = today.AddDays(-WindowDays);

        await this.BackfillExchangeRatesAsync(since, today, cts.Token);
        await this.BackfillCryptoRatesAsync(since, today, cts.Token);
    }

    private async Task BackfillExchangeRatesAsync(
        DateTime since,
        DateTime today,
        CancellationToken cancellationToken
    )
    {
        var stored = await this
            .context.ExchangeRates.Where(r => r.RecordedAt >= since && r.RecordedAt < today)
            .Select(r => new { r.Type, Day = r.RecordedAt.Date })
            .Distinct()
            .ToListAsync(cancellationToken);
        var storedDays = stored.Select(x => (x.Type, x.Day)).ToHashSet();

        var added = new List<ExchangeRate>();

        foreach (var (apiPath, dbType) in DollarTypes)
        {
            var missing = MissingDays(since, today, day => storedDays.Contains((dbType, day)));
            if (missing.Count == 0)
                continue;

            var history = await this.dolarApiClient.FetchHistoricalRatesAsync(
                apiPath,
                dbType,
                WindowDays,
                cancellationToken
            );

            added.AddRange(
                history
                    .Where(r => r.Sell > 0 && missing.Contains(r.RecordedAt.Date))
                    .DistinctBy(r => r.RecordedAt.Date)
            );
        }

        if (added.Count == 0)
            return;

        this.context.ExchangeRates.AddRange(added);
        await this.context.SaveChangesAsync(cancellationToken);
        this.logger.LogInformation("Backfilled {Count} missing daily exchange rates.", added.Count);
    }

    private async Task BackfillCryptoRatesAsync(
        DateTime since,
        DateTime today,
        CancellationToken cancellationToken
    )
    {
        var stored = await this
            .context.CryptoRates.Where(r => r.RecordedAt >= since && r.RecordedAt < today)
            .Select(r => new { r.Symbol, Day = r.RecordedAt.Date })
            .Distinct()
            .ToListAsync(cancellationToken);
        var storedDays = stored.Select(x => (x.Symbol, x.Day)).ToHashSet();

        var pending = Coins
            .Select(coin =>
                (
                    coin.CoinId,
                    coin.Symbol,
                    Missing: MissingDays(
                        since,
                        today,
                        day => storedDays.Contains((coin.Symbol, day))
                    )
                )
            )
            .Where(coin => coin.Missing.Count > 0)
            .ToList();

        if (pending.Count == 0)
            return;

        // Crypto is stored in ARS at each day's blue rate, which the exchange backfill has
        // just completed, so every missing crypto day has a real rate to convert with.
        var blueByDay = await this.LoadBlueSellByDayAsync(since, today, cancellationToken);
        var hadNoCrypto = stored.Count == 0;
        var added = new List<CryptoRate>();

        for (var i = 0; i < pending.Count; i++)
        {
            if (i > 0)
                await Task.Delay(CoinGeckoSpacing, cancellationToken);

            var (coinId, symbol, missing) = pending[i];
            var chart = await this.coinGeckoClient.FetchMarketChartAsync(
                coinId,
                symbol,
                blueByDay,
                cancellationToken
            );

            // The chart is hourly; keep each missing day's last point as its close.
            added.AddRange(
                chart
                    .Where(r =>
                        missing.Contains(r.RecordedAt.Date)
                        && blueByDay.ContainsKey(r.RecordedAt.Date)
                    )
                    .GroupBy(r => r.RecordedAt.Date)
                    .Select(g => g.MaxBy(r => r.RecordedAt)!)
            );
        }

        // A brand-new database with CoinGecko unreachable still gets a chart to render.
        // Never used to patch gaps: invented prices would sit among real ones.
        if (added.Count == 0 && hadNoCrypto)
            added = GenerateSimulatedCrypto(blueByDay);

        if (added.Count == 0)
            return;

        this.context.CryptoRates.AddRange(added);
        await this.context.SaveChangesAsync(cancellationToken);
        this.logger.LogInformation("Backfilled {Count} missing daily crypto prices.", added.Count);
    }

    private async Task<Dictionary<DateTime, decimal>> LoadBlueSellByDayAsync(
        DateTime since,
        DateTime today,
        CancellationToken cancellationToken
    )
    {
        var blue = await this
            .context.ExchangeRates.Where(r =>
                r.Type == "blue" && r.Sell > 0 && r.RecordedAt >= since && r.RecordedAt < today
            )
            .Select(r => new { r.RecordedAt, r.Sell })
            .ToListAsync(cancellationToken);

        return blue.GroupBy(r => r.RecordedAt.Date)
            .ToDictionary(g => g.Key, g => g.MaxBy(r => r.RecordedAt)!.Sell);
    }

    private static HashSet<DateTime> MissingDays(
        DateTime since,
        DateTime today,
        Func<DateTime, bool> isStored
    )
    {
        var missing = new HashSet<DateTime>();
        for (var day = since; day < today; day = day.AddDays(1))
        {
            if (!isStored(day))
                missing.Add(day);
        }
        return missing;
    }

    private static List<CryptoRate> GenerateSimulatedCrypto(
        IReadOnlyDictionary<DateTime, decimal> blueRateByDate
    )
    {
        var random = new Random(99);
        var rates = new List<CryptoRate>();
        decimal btcUsd = 82_000m;
        decimal ethUsd = 2_700m;
        var fallback = blueRateByDate.Values.DefaultIfEmpty(1200m).Last();

        foreach (var (date, blueRate) in blueRateByDate.OrderBy(x => x.Key))
        {
            btcUsd += btcUsd * (decimal)(random.NextDouble() * 0.04 - 0.018);
            ethUsd += ethUsd * (decimal)(random.NextDouble() * 0.04 - 0.018);
            btcUsd = Math.Max(btcUsd, 50_000m);
            ethUsd = Math.Max(ethUsd, 1_500m);

            var arsRate = blueRate > 0 ? blueRate : fallback;
            var ts = DateTime.SpecifyKind(date.AddHours(12), DateTimeKind.Utc);

            rates.Add(
                new CryptoRate
                {
                    Symbol = "BTC",
                    PriceUsd = Math.Round(btcUsd, 2),
                    PriceArs = Math.Round(btcUsd * arsRate, 2),
                    ChangePercent24h = 0,
                    RecordedAt = ts,
                }
            );
            rates.Add(
                new CryptoRate
                {
                    Symbol = "ETH",
                    PriceUsd = Math.Round(ethUsd, 2),
                    PriceArs = Math.Round(ethUsd * arsRate, 2),
                    ChangePercent24h = 0,
                    RecordedAt = ts,
                }
            );
        }

        return rates;
    }
}
