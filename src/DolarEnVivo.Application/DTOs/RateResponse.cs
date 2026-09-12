using DolarEnVivo.Domain.Entities;

namespace DolarEnVivo.Application.DTOs;

public record RateResponse
{
    public int Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public decimal Buy { get; init; }
    public decimal Sell { get; init; }
    public decimal ChangePercent { get; init; }
    public DateTime RecordedAt { get; init; }

    public static RateResponse FromEntity(ExchangeRate entity, decimal changePercent = 0) =>
        new()
        {
            Id = entity.Id,
            Type = entity.Type,
            Buy = entity.Buy,
            Sell = entity.Sell,
            ChangePercent = changePercent,
            RecordedAt = AsUtc(entity.RecordedAt),
        };

    // SQLite hands timestamps back with an unspecified kind, which serializes without a
    // zone and leaves browsers reading UTC values as local time.
    internal static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
}

public record CryptoRateResponse
{
    public int Id { get; init; }
    public string Symbol { get; init; } = string.Empty;
    public decimal PriceUsd { get; init; }
    public decimal PriceArs { get; init; }
    public decimal ChangePercent { get; init; }
    public DateTime RecordedAt { get; init; }

    public static CryptoRateResponse FromEntity(CryptoRate entity, decimal changePercent = 0) =>
        new()
        {
            Id = entity.Id,
            Symbol = entity.Symbol,
            PriceUsd = entity.PriceUsd,
            PriceArs = entity.PriceArs,
            ChangePercent = changePercent,
            RecordedAt = RateResponse.AsUtc(entity.RecordedAt),
        };
}

public record LatestRatesResponse
{
    public IEnumerable<RateResponse> ExchangeRates { get; init; } = [];
    public IEnumerable<CryptoRateResponse> CryptoRates { get; init; } = [];
    public DateTime FetchedAt { get; init; } = DateTime.UtcNow;
}
