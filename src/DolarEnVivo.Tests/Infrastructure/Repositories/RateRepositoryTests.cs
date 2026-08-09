using DolarEnVivo.Domain.Entities;
using DolarEnVivo.Infrastructure.Data;
using DolarEnVivo.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;

namespace DolarEnVivo.Tests.Infrastructure.Repositories;

public class RateRepositoryTests : IDisposable
{
    private readonly SqliteConnectionFixture fixture = new();
    private readonly AppDbContext context;
    private readonly RateRepository sut;

    public RateRepositoryTests()
    {
        this.context = this.fixture.CreateContext();
        this.sut = new RateRepository(this.context);
    }

    public void Dispose() => this.fixture.Dispose();

    public class The_Method_GetLatestRatesAsync : RateRepositoryTests
    {
        [Fact]
        public async Task Should_return_the_most_recent_rate_per_type()
        {
            var now = DateTime.UtcNow;
            this.context.ExchangeRates.AddRange(
                new ExchangeRate
                {
                    Type = "blue",
                    Buy = 1000,
                    Sell = 1010,
                    RecordedAt = now.AddMinutes(-30),
                },
                new ExchangeRate
                {
                    Type = "blue",
                    Buy = 1200,
                    Sell = 1210,
                    RecordedAt = now,
                },
                new ExchangeRate
                {
                    Type = "oficial",
                    Buy = 900,
                    Sell = 910,
                    RecordedAt = now.AddMinutes(-15),
                }
            );
            await this.context.SaveChangesAsync();

            var result = (await this.sut.GetLatestRatesAsync(CancellationToken.None)).ToList();

            Assert.Equal(2, result.Count);
            Assert.Equal(1210m, result.Single(r => r.Type == "blue").Sell);
            Assert.Equal(910m, result.Single(r => r.Type == "oficial").Sell);
        }
    }

    public class The_Method_GetPreviousDayRatesAsync : RateRepositoryTests
    {
        [Fact]
        public async Task Should_return_the_latest_rate_before_each_types_own_most_recent_day()
        {
            var today = DateTime.UtcNow.Date;
            this.context.ExchangeRates.AddRange(
                new ExchangeRate
                {
                    Type = "blue",
                    Buy = 990,
                    Sell = 1000,
                    RecordedAt = today.AddDays(-1).AddHours(10),
                },
                new ExchangeRate
                {
                    Type = "blue",
                    Buy = 1090,
                    Sell = 1100,
                    RecordedAt = today.AddHours(9),
                },
                // Stopped updating yesterday: its latest day differs from blue's.
                new ExchangeRate
                {
                    Type = "oficial",
                    Buy = 790,
                    Sell = 800,
                    RecordedAt = today.AddDays(-2).AddHours(11),
                },
                new ExchangeRate
                {
                    Type = "oficial",
                    Buy = 890,
                    Sell = 900,
                    RecordedAt = today.AddDays(-1).AddHours(11),
                }
            );
            await this.context.SaveChangesAsync();

            var result = (await this.sut.GetPreviousDayRatesAsync(CancellationToken.None)).ToList();

            Assert.Equal(2, result.Count);
            Assert.Equal(1000m, result.Single(r => r.Type == "blue").Sell);
            Assert.Equal(800m, result.Single(r => r.Type == "oficial").Sell);
        }
    }

    public class The_Method_GetLatestCryptoRatesAsync : RateRepositoryTests
    {
        [Fact]
        public async Task Should_return_the_most_recent_rate_per_symbol()
        {
            var now = DateTime.UtcNow;
            this.context.CryptoRates.AddRange(
                new CryptoRate
                {
                    Symbol = "BTC",
                    PriceUsd = 60000,
                    PriceArs = 90000000,
                    RecordedAt = now.AddMinutes(-30),
                },
                new CryptoRate
                {
                    Symbol = "BTC",
                    PriceUsd = 65000,
                    PriceArs = 97000000,
                    RecordedAt = now,
                },
                new CryptoRate
                {
                    Symbol = "ETH",
                    PriceUsd = 1900,
                    PriceArs = 2900000,
                    RecordedAt = now.AddMinutes(-15),
                }
            );
            await this.context.SaveChangesAsync();

            var result = (
                await this.sut.GetLatestCryptoRatesAsync(CancellationToken.None)
            ).ToList();

            Assert.Equal(2, result.Count);
            Assert.Equal(65000m, result.Single(r => r.Symbol == "BTC").PriceUsd);
            Assert.Equal(1900m, result.Single(r => r.Symbol == "ETH").PriceUsd);
        }
    }

    public class The_Method_GetPreviousDayCryptoRatesAsync : RateRepositoryTests
    {
        [Fact]
        public async Task Should_return_the_latest_rate_before_each_symbols_own_most_recent_day()
        {
            var today = DateTime.UtcNow.Date;
            this.context.CryptoRates.AddRange(
                new CryptoRate
                {
                    Symbol = "BTC",
                    PriceUsd = 60000,
                    PriceArs = 90000000,
                    RecordedAt = today.AddDays(-1).AddHours(10),
                },
                new CryptoRate
                {
                    Symbol = "BTC",
                    PriceUsd = 65000,
                    PriceArs = 97000000,
                    RecordedAt = today.AddHours(9),
                }
            );
            await this.context.SaveChangesAsync();

            var result = (
                await this.sut.GetPreviousDayCryptoRatesAsync(CancellationToken.None)
            ).ToList();

            Assert.Single(result);
            Assert.Equal(60000m, result[0].PriceUsd);
        }
    }
}

/// <summary>
/// File-backed SQLite per test, so queries are verified against real SQL
/// translation rather than the in-memory provider's looser semantics.
/// </summary>
public sealed class SqliteConnectionFixture : IDisposable
{
    private readonly string dbPath = Path.Combine(
        Path.GetTempPath(),
        $"dolarenvivo-test-{Guid.NewGuid()}.db"
    );

    public AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite($"Data Source={this.dbPath}")
            .Options;
        var context = new AppDbContext(options);
        context.Database.EnsureCreated();
        return context;
    }

    public void Dispose()
    {
        if (File.Exists(this.dbPath))
            File.Delete(this.dbPath);
    }
}
