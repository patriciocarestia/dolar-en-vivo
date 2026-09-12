namespace DolarEnVivo.Application.Interfaces;

/// <summary>
/// Refreshes stored rates on demand, so freshness never depends on a background
/// scheduler surviving inside a web app that the host is free to unload at any time.
/// </summary>
public interface IRateRefreshService
{
    /// <summary>
    /// Fetches and stores rates when the newest record is older than <paramref name="maxAge"/>.
    /// Never throws: the read path must keep serving whatever is on record even when the
    /// upstream providers are down.
    /// </summary>
    Task<RateRefreshResult> EnsureFreshAsync(TimeSpan maxAge, CancellationToken cancellationToken);
}

public record RateRefreshResult
{
    public bool Refreshed { get; init; }

    public DateTime? LatestRateAt { get; init; }

    /// <summary>Why the refresh was or was not performed, for logs and the health endpoint.</summary>
    public string Reason { get; init; } = string.Empty;
}
