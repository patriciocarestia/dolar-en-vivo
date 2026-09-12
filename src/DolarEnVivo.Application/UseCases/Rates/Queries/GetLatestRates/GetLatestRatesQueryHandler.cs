using DolarEnVivo.Application.DTOs;
using DolarEnVivo.Application.Interfaces;
using MediatR;
using Microsoft.Extensions.Caching.Memory;

namespace DolarEnVivo.Application.UseCases.Rates.Queries.GetLatestRates;

public class GetLatestRatesQueryHandler : IRequestHandler<GetLatestRatesQuery, LatestRatesResponse>
{
    private const string CacheKey = "rates:latest";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(60);

    private static readonly TimeSpan MaxRateAge = TimeSpan.FromMinutes(15);

    private readonly IRateRepository rateRepository;
    private readonly IMemoryCache cache;
    private readonly IRateRefreshService refreshService;

    public GetLatestRatesQueryHandler(
        IRateRepository rateRepository,
        IMemoryCache cache,
        IRateRefreshService refreshService
    )
    {
        ArgumentNullException.ThrowIfNull(rateRepository, nameof(rateRepository));
        ArgumentNullException.ThrowIfNull(cache, nameof(cache));
        ArgumentNullException.ThrowIfNull(refreshService, nameof(refreshService));
        this.rateRepository = rateRepository;
        this.cache = cache;
        this.refreshService = refreshService;
    }

    public async Task<LatestRatesResponse> Handle(
        GetLatestRatesQuery request,
        CancellationToken cancellationToken
    )
    {
        if (this.cache.TryGetValue(CacheKey, out LatestRatesResponse? cached) && cached is not null)
            return cached;

        // The background job only runs while the host keeps the app alive, which it does not
        // guarantee. Serving a read is the one moment we know the app is running, so it is
        // also the moment to top up anything that went stale meanwhile.
        await this.refreshService.EnsureFreshAsync(MaxRateAge, cancellationToken);

        var response = await this.BuildResponseAsync(cancellationToken);
        this.cache.Set(CacheKey, response, CacheDuration);
        return response;
    }

    private async Task<LatestRatesResponse> BuildResponseAsync(CancellationToken cancellationToken)
    {
        var exchangeRates = await this.rateRepository.GetLatestRatesAsync(cancellationToken);
        var previousExchangeRates = await this.rateRepository.GetPreviousDayRatesAsync(
            cancellationToken
        );
        var cryptoRates = await this.rateRepository.GetLatestCryptoRatesAsync(cancellationToken);
        var previousCryptoRates = await this.rateRepository.GetPreviousDayCryptoRatesAsync(
            cancellationToken
        );

        var prevExchangeByType = previousExchangeRates.ToDictionary(r => r.Type);
        var prevCryptoBySymbol = previousCryptoRates.ToDictionary(r => r.Symbol);

        return new LatestRatesResponse
        {
            ExchangeRates = exchangeRates.Select(r =>
            {
                decimal change = 0;
                if (prevExchangeByType.TryGetValue(r.Type, out var prev) && prev.Sell > 0)
                    change = Math.Round((r.Sell - prev.Sell) / prev.Sell * 100, 2);
                return RateResponse.FromEntity(r, change);
            }),
            CryptoRates = cryptoRates.Select(r =>
            {
                decimal change = 0;
                if (prevCryptoBySymbol.TryGetValue(r.Symbol, out var prev) && prev.PriceArs > 0)
                    change = Math.Round((r.PriceArs - prev.PriceArs) / prev.PriceArs * 100, 2);
                return CryptoRateResponse.FromEntity(r, change);
            }),
            FetchedAt = DateTime.UtcNow,
        };
    }
}
