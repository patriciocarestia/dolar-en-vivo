using DolarEnVivo.Application.Interfaces;
using DolarEnVivo.Application.UseCases.Rates.Queries.GetLatestRates;
using DolarEnVivo.Domain.Entities;
using Microsoft.Extensions.Caching.Memory;
using Moq;

namespace DolarEnVivo.Tests.Application.UseCases.Rates;

public class GetLatestRatesQueryHandlerTests
{
    private static IMemoryCache CreateCache() => new MemoryCache(new MemoryCacheOptions());

    private static IRateRefreshService CreateRefreshService()
    {
        var refreshService = Mock.Of<IRateRefreshService>();
        Mock.Get(refreshService)
            .Setup(r => r.EnsureFreshAsync(It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new RateRefreshResult { Reason = "fresh" });
        return refreshService;
    }

    public class The_Constructor : GetLatestRatesQueryHandlerTests
    {
        [Fact]
        public void Should_throw_ArgumentNullException_when_rateRepository_is_null()
        {
            Assert.Throws<ArgumentNullException>(() =>
                new GetLatestRatesQueryHandler(null!, CreateCache(), CreateRefreshService())
            );
        }
    }

    public class The_Method_Handle : GetLatestRatesQueryHandlerTests
    {
        [Fact]
        public async Task Should_return_LatestRatesResponse_with_mapped_data()
        {
            var exchangeRates = new List<ExchangeRate>
            {
                new()
                {
                    Id = 1,
                    Type = "blue",
                    Buy = 1200m,
                    Sell = 1250m,
                    RecordedAt = DateTime.UtcNow,
                },
                new()
                {
                    Id = 2,
                    Type = "oficial",
                    Buy = 800m,
                    Sell = 850m,
                    RecordedAt = DateTime.UtcNow,
                },
            };
            var cryptoRates = new List<CryptoRate>
            {
                new()
                {
                    Id = 1,
                    Symbol = "BTC",
                    PriceUsd = 65000m,
                    PriceArs = 81250000m,
                    ChangePercent24h = 2.5m,
                    RecordedAt = DateTime.UtcNow,
                },
            };

            var repository = Mock.Of<IRateRepository>();
            Mock.Get(repository)
                .Setup(r => r.GetLatestRatesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(exchangeRates);
            Mock.Get(repository)
                .Setup(r => r.GetLatestCryptoRatesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(cryptoRates);

            var sut = new GetLatestRatesQueryHandler(
                repository,
                CreateCache(),
                CreateRefreshService()
            );

            var result = await sut.Handle(new GetLatestRatesQuery(), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(2, result.ExchangeRates.Count());
            Assert.Equal(1, result.CryptoRates.Count());
            Assert.Equal("blue", result.ExchangeRates.First().Type);
            Assert.Equal(1250m, result.ExchangeRates.First().Sell);
        }

        [Fact]
        public async Task Should_return_empty_collections_when_no_data()
        {
            var repository = Mock.Of<IRateRepository>();
            Mock.Get(repository)
                .Setup(r => r.GetLatestRatesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);
            Mock.Get(repository)
                .Setup(r => r.GetLatestCryptoRatesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);

            var sut = new GetLatestRatesQueryHandler(
                repository,
                CreateCache(),
                CreateRefreshService()
            );

            var result = await sut.Handle(new GetLatestRatesQuery(), CancellationToken.None);

            Assert.NotNull(result);
            Assert.Empty(result.ExchangeRates);
            Assert.Empty(result.CryptoRates);
        }
    }
}
