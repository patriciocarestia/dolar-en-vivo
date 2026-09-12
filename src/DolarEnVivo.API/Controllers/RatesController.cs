using DolarEnVivo.API.Controllers.Base;
using DolarEnVivo.Application.DTOs;
using DolarEnVivo.Application.Interfaces;
using DolarEnVivo.Application.UseCases.Rates.Queries.GetCryptoHistory;
using DolarEnVivo.Application.UseCases.Rates.Queries.GetLatestRates;
using DolarEnVivo.Application.UseCases.Rates.Queries.GetRateHistory;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace DolarEnVivo.API.Controllers;

/// <summary>
/// Provides exchange rate and crypto price data
/// </summary>
public class RatesController : BaseController
{
    private static readonly TimeSpan MaxRateAge = TimeSpan.FromMinutes(15);

    public RatesController(IMediator mediator)
        : base(mediator) { }

    /// <summary>
    /// Gets the latest exchange rates and crypto prices
    /// </summary>
    [HttpGet("latest")]
    [Produces("application/json", Type = typeof(LatestRatesResponse))]
    [ProducesResponseType(typeof(LatestRatesResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLatestAsync(CancellationToken cancellationToken) =>
        Ok(await this.Mediator.Send(new GetLatestRatesQuery(), cancellationToken));

    /// <summary>
    /// Refreshes the stored rates when they have gone stale. Safe to call from an external
    /// scheduler as often as you like: it is a no-op while the data is current, and
    /// concurrent callers collapse into a single upstream fetch.
    /// </summary>
    [HttpPost("refresh")]
    [ProducesResponseType(typeof(RateRefreshResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> RefreshAsync(
        [FromServices] IRateRefreshService refreshService,
        CancellationToken cancellationToken
    ) => Ok(await refreshService.EnsureFreshAsync(MaxRateAge, cancellationToken));

    /// <summary>
    /// Gets historical exchange rate data
    /// </summary>
    [HttpGet("history")]
    [Produces("application/json", Type = typeof(IEnumerable<RateResponse>))]
    [ProducesResponseType(typeof(IEnumerable<RateResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetHistoryAsync(
        [FromQuery] string type = "blue",
        [FromQuery] int days = 30,
        CancellationToken cancellationToken = default
    ) =>
        Ok(
            await this.Mediator.Send(
                new GetRateHistoryQuery { Type = type, Days = days },
                cancellationToken
            )
        );

    /// <summary>
    /// Gets historical crypto price data
    /// </summary>
    [HttpGet("crypto-history")]
    [Produces("application/json", Type = typeof(IEnumerable<CryptoRateResponse>))]
    [ProducesResponseType(typeof(IEnumerable<CryptoRateResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCryptoHistoryAsync(
        [FromQuery] string symbol = "BTC",
        [FromQuery] int days = 7,
        CancellationToken cancellationToken = default
    ) =>
        Ok(
            await this.Mediator.Send(
                new GetCryptoHistoryQuery { Symbol = symbol, Days = days },
                cancellationToken
            )
        );
}
