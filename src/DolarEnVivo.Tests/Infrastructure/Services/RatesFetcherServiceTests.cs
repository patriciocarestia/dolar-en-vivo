using System.Net;
using System.Text;
using DolarEnVivo.Application.Interfaces;
using DolarEnVivo.Domain.Entities;
using DolarEnVivo.Infrastructure.ExternalApis;
using DolarEnVivo.Infrastructure.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace DolarEnVivo.Tests.Infrastructure.Services;

public class RatesFetcherServiceTests
{
    private const string DolarApiPayload = """
        [
          { "casa": "oficial", "compra": 1470, "venta": 1520 },
          { "casa": "blue", "compra": 1505, "venta": 1525 }
        ]
        """;

    private const string CoinGeckoPayload = """
        { "bitcoin": { "usd": 65000, "usd_24h_change": 1.5 } }
        """;

    private static RatesFetcherService CreateSut(
        IRateRepository repository,
        HttpStatusCode dolarStatus = HttpStatusCode.OK,
        string dolarPayload = DolarApiPayload
    ) =>
        new(
            new DolarApiClient(
                new HttpClient(new StubHandler(dolarStatus, dolarPayload)),
                NullLogger<DolarApiClient>.Instance
            ),
            new CoinGeckoClient(
                new HttpClient(new StubHandler(HttpStatusCode.OK, CoinGeckoPayload)),
                NullLogger<CoinGeckoClient>.Instance
            ),
            repository,
            new MemoryCache(new MemoryCacheOptions()),
            NullLogger<RatesFetcherService>.Instance
        );

    public class The_Method_FetchAndStoreAllRatesAsync : RatesFetcherServiceTests
    {
        [Fact]
        public async Task Should_store_the_fetched_rates()
        {
            var repository = Mock.Of<IRateRepository>();
            var sut = CreateSut(repository);

            await sut.FetchAndStoreAllRatesAsync();

            Mock.Get(repository)
                .Verify(
                    r =>
                        r.AddExchangeRatesAsync(
                            It.Is<IEnumerable<ExchangeRate>>(rates =>
                                rates.Any(x => x.Type == "blue")
                            ),
                            It.IsAny<CancellationToken>()
                        ),
                    Times.Once
                );
        }

        [Fact]
        public async Task Should_throw_when_the_provider_returns_nothing()
        {
            var repository = Mock.Of<IRateRepository>();
            var sut = CreateSut(repository, HttpStatusCode.ServiceUnavailable, "");

            await Assert.ThrowsAsync<InvalidOperationException>(sut.FetchAndStoreAllRatesAsync);

            Mock.Get(repository)
                .Verify(
                    r =>
                        r.AddExchangeRatesAsync(
                            It.IsAny<IEnumerable<ExchangeRate>>(),
                            It.IsAny<CancellationToken>()
                        ),
                    Times.Never
                );
        }
    }

    public class The_Method_EnsureFreshAsync : RatesFetcherServiceTests
    {
        [Fact]
        public async Task Should_not_fetch_when_the_stored_rates_are_recent()
        {
            var repository = Mock.Of<IRateRepository>();
            Mock.Get(repository)
                .Setup(r => r.GetLatestRateTimestampAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(DateTime.UtcNow.AddMinutes(-2));
            var sut = CreateSut(repository);

            var result = await sut.EnsureFreshAsync(
                TimeSpan.FromMinutes(15),
                CancellationToken.None
            );

            Assert.False(result.Refreshed);
            Assert.Equal("fresh", result.Reason);
            Mock.Get(repository)
                .Verify(
                    r =>
                        r.AddExchangeRatesAsync(
                            It.IsAny<IEnumerable<ExchangeRate>>(),
                            It.IsAny<CancellationToken>()
                        ),
                    Times.Never
                );
        }

        [Fact]
        public async Task Should_fetch_when_the_stored_rates_are_stale()
        {
            var repository = Mock.Of<IRateRepository>();
            Mock.Get(repository)
                .Setup(r => r.GetLatestRateTimestampAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(DateTime.UtcNow.AddDays(-30));
            var sut = CreateSut(repository);

            var result = await sut.EnsureFreshAsync(
                TimeSpan.FromMinutes(15),
                CancellationToken.None
            );

            Assert.True(result.Refreshed);
            Mock.Get(repository)
                .Verify(
                    r =>
                        r.AddExchangeRatesAsync(
                            It.IsAny<IEnumerable<ExchangeRate>>(),
                            It.IsAny<CancellationToken>()
                        ),
                    Times.Once
                );
        }

        [Fact]
        public async Task Should_report_the_failure_instead_of_throwing_when_the_provider_is_down()
        {
            var repository = Mock.Of<IRateRepository>();
            Mock.Get(repository)
                .Setup(r => r.GetLatestRateTimestampAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(DateTime.UtcNow.AddDays(-30));
            var sut = CreateSut(repository, HttpStatusCode.ServiceUnavailable, "");

            var result = await sut.EnsureFreshAsync(
                TimeSpan.FromMinutes(15),
                CancellationToken.None
            );

            Assert.False(result.Refreshed);
            Assert.Equal("refresh-failed", result.Reason);
        }
    }

    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly HttpStatusCode status;
        private readonly string payload;

        public StubHandler(HttpStatusCode status, string payload)
        {
            this.status = status;
            this.payload = payload;
        }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        ) =>
            Task.FromResult(
                new HttpResponseMessage(this.status)
                {
                    Content = new StringContent(this.payload, Encoding.UTF8, "application/json"),
                }
            );
    }
}
