using DolarEnVivo.Application.Interfaces;
using DolarEnVivo.Domain.Entities;
using DolarEnVivo.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace DolarEnVivo.Infrastructure.Repositories;

public class RateRepository : IRateRepository
{
    private readonly AppDbContext context;

    public RateRepository(AppDbContext context)
    {
        ArgumentNullException.ThrowIfNull(context, nameof(context));
        this.context = context;
    }

    private static readonly string[] ExchangeRateTypes =
    [
        "oficial",
        "blue",
        "mep",
        "ccl",
        "cripto",
    ];
    private static readonly string[] CryptoSymbols = ["BTC", "ETH"];

    public async Task<IEnumerable<ExchangeRate>> GetLatestRatesAsync(
        CancellationToken cancellationToken
    )
    {
        return await this
            .context.ExchangeRates.Where(r => ExchangeRateTypes.Contains(r.Type))
            .GroupBy(r => r.Type)
            .Select(g => g.OrderByDescending(r => r.RecordedAt).First())
            .ToListAsync(cancellationToken);
    }

    public async Task<DateTime?> GetLatestRateTimestampAsync(CancellationToken cancellationToken)
    {
        var latest = await this
            .context.ExchangeRates.Where(r => ExchangeRateTypes.Contains(r.Type))
            .MaxAsync(r => (DateTime?)r.RecordedAt, cancellationToken);

        return latest is null ? null : DateTime.SpecifyKind(latest.Value, DateTimeKind.Utc);
    }

    public async Task<IEnumerable<ExchangeRate>> GetPreviousDayRatesAsync(
        CancellationToken cancellationToken
    )
    {
        var maxDates = this
            .context.ExchangeRates.Where(r => ExchangeRateTypes.Contains(r.Type))
            .GroupBy(r => r.Type)
            .Select(g => new { Type = g.Key, MaxDate = g.Max(r => r.RecordedAt) });

        return await this
            .context.ExchangeRates.Where(r => ExchangeRateTypes.Contains(r.Type))
            .Join(maxDates, r => r.Type, m => m.Type, (r, m) => new { Rate = r, m.MaxDate })
            .Where(x => x.Rate.RecordedAt < x.MaxDate.Date)
            .GroupBy(x => x.Rate.Type)
            .Select(g => g.OrderByDescending(x => x.Rate.RecordedAt).First().Rate)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<ExchangeRate>> GetRateHistoryAsync(
        string type,
        int days,
        CancellationToken cancellationToken
    )
    {
        var since = DateTime.UtcNow.AddDays(-days);
        return await this
            .context.ExchangeRates.Where(r => r.Type == type && r.RecordedAt >= since)
            .OrderBy(r => r.RecordedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<CryptoRate>> GetLatestCryptoRatesAsync(
        CancellationToken cancellationToken
    )
    {
        return await this
            .context.CryptoRates.Where(r => CryptoSymbols.Contains(r.Symbol))
            .GroupBy(r => r.Symbol)
            .Select(g => g.OrderByDescending(r => r.RecordedAt).First())
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<CryptoRate>> GetPreviousDayCryptoRatesAsync(
        CancellationToken cancellationToken
    )
    {
        var maxDates = this
            .context.CryptoRates.Where(r => CryptoSymbols.Contains(r.Symbol))
            .GroupBy(r => r.Symbol)
            .Select(g => new { Symbol = g.Key, MaxDate = g.Max(r => r.RecordedAt) });

        return await this
            .context.CryptoRates.Where(r => CryptoSymbols.Contains(r.Symbol))
            .Join(maxDates, r => r.Symbol, m => m.Symbol, (r, m) => new { Rate = r, m.MaxDate })
            .Where(x => x.Rate.RecordedAt < x.MaxDate.Date)
            .GroupBy(x => x.Rate.Symbol)
            .Select(g => g.OrderByDescending(x => x.Rate.RecordedAt).First().Rate)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<CryptoRate>> GetCryptoHistoryAsync(
        string symbol,
        int days,
        CancellationToken cancellationToken
    )
    {
        var since = DateTime.UtcNow.AddDays(-days);
        return await this
            .context.CryptoRates.Where(r => r.Symbol == symbol && r.RecordedAt >= since)
            .OrderBy(r => r.RecordedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task AddExchangeRatesAsync(
        IEnumerable<ExchangeRate> rates,
        CancellationToken cancellationToken
    )
    {
        this.context.ExchangeRates.AddRange(rates);
        await this.context.SaveChangesAsync(cancellationToken);
    }

    public async Task AddCryptoRatesAsync(
        IEnumerable<CryptoRate> rates,
        CancellationToken cancellationToken
    )
    {
        this.context.CryptoRates.AddRange(rates);
        await this.context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteRatesOlderThanAsync(
        DateTime cutoff,
        CancellationToken cancellationToken
    )
    {
        await this
            .context.ExchangeRates.Where(r => r.RecordedAt < cutoff)
            .ExecuteDeleteAsync(cancellationToken);

        await this
            .context.CryptoRates.Where(r => r.RecordedAt < cutoff)
            .ExecuteDeleteAsync(cancellationToken);
    }
}
