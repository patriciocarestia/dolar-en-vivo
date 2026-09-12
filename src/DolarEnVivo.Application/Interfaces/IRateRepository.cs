using DolarEnVivo.Domain.Entities;

namespace DolarEnVivo.Application.Interfaces;

public interface IRateRepository
{
    Task<IEnumerable<ExchangeRate>> GetLatestRatesAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Timestamp of the most recent exchange rate on record, or null when the table is empty.
    /// Used to decide whether the stored data is stale enough to warrant a refresh.
    /// </summary>
    Task<DateTime?> GetLatestRateTimestampAsync(CancellationToken cancellationToken);
    Task<IEnumerable<ExchangeRate>> GetPreviousDayRatesAsync(CancellationToken cancellationToken);
    Task<IEnumerable<ExchangeRate>> GetRateHistoryAsync(
        string type,
        int days,
        CancellationToken cancellationToken
    );
    Task<IEnumerable<CryptoRate>> GetLatestCryptoRatesAsync(CancellationToken cancellationToken);
    Task<IEnumerable<CryptoRate>> GetPreviousDayCryptoRatesAsync(
        CancellationToken cancellationToken
    );
    Task<IEnumerable<CryptoRate>> GetCryptoHistoryAsync(
        string symbol,
        int days,
        CancellationToken cancellationToken
    );
    Task AddExchangeRatesAsync(
        IEnumerable<ExchangeRate> rates,
        CancellationToken cancellationToken
    );
    Task AddCryptoRatesAsync(IEnumerable<CryptoRate> rates, CancellationToken cancellationToken);
    Task DeleteRatesOlderThanAsync(DateTime cutoff, CancellationToken cancellationToken);
}
