using System.Globalization;
using System.Net;
using System.Text;
using DolarEnVivo.Domain.Entities;
using DolarEnVivo.Infrastructure.Data;
using DolarEnVivo.Infrastructure.ExternalApis;
using DolarEnVivo.Infrastructure.Services;
using DolarEnVivo.Tests.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace DolarEnVivo.Tests.Infrastructure.Services;

public class HistoricalDataSeederTests : IDisposable
{
    private static readonly string[] ExchangeTypes = ["oficial", "blue", "mep", "ccl", "cripto"];
    private static readonly string[] CryptoSymbols = ["BTC", "ETH"];

    private readonly SqliteConnectionFixture fixture = new();
    private readonly AppDbContext context;
    private readonly DateTime today = DateTime.UtcNow.Date;

    public HistoricalDataSeederTests()
    {
        this.context = this.fixture.CreateContext();
    }

    public void Dispose() => this.fixture.Dispose();

    private HistoricalDataSeeder CreateSut(RoutingHandler handler) =>
        new(
            this.context,
            new DolarApiClient(new HttpClient(handler), NullLogger<DolarApiClient>.Instance),
            new CoinGeckoClient(new HttpClient(handler), NullLogger<CoinGeckoClient>.Instance),
            NullLogger<HistoricalDataSeeder>.Instance
        );

    private static string DailyRatesPayload(params (DateTime Day, decimal Sell)[] days) =>
        "["
        + string.Join(
            ",",
            days.Select(d =>
                $$"""{"fecha":"{{d.Day:yyyy-MM-dd}}","compra":{{(d.Sell - 20).ToString(CultureInfo.InvariantCulture)}},"venta":{{d.Sell.ToString(CultureInfo.InvariantCulture)}}}"""
            )
        )
        + "]";

    private static string MarketChartPayload(params (DateTime At, decimal Usd)[] points) =>
        $$"""{"prices":[{{string.Join(
            ",",
            points.Select(p =>
                $"[{new DateTimeOffset(p.At, TimeSpan.Zero).ToUnixTimeMilliseconds()},{p.Usd.ToString(CultureInfo.InvariantCulture)}]"
            )
        )}}]}""";

    private void StoreEveryDay(Func<DateTime, bool>? skipExchangeRates = null)
    {
        for (var day = this.today.AddDays(-90); day < this.today; day = day.AddDays(1))
        {
            foreach (var type in ExchangeTypes)
            {
                if (skipExchangeRates?.Invoke(day) == true)
                    break;

                this.context.ExchangeRates.Add(
                    new ExchangeRate
                    {
                        Type = type,
                        Buy = 1480,
                        Sell = 1500,
                        RecordedAt = day.AddHours(15),
                    }
                );
            }

            foreach (var symbol in CryptoSymbols)
            {
                this.context.CryptoRates.Add(
                    new CryptoRate
                    {
                        Symbol = symbol,
                        PriceUsd = 1,
                        PriceArs = 1500,
                        RecordedAt = day.AddHours(15),
                    }
                );
            }
        }
        this.context.SaveChanges();
    }

    public class The_Method_SeedAsync : HistoricalDataSeederTests
    {
        [Fact]
        public async Task Should_make_no_upstream_calls_when_no_day_is_missing()
        {
            this.StoreEveryDay();
            var handler = new RoutingHandler();

            await this.CreateSut(handler).SeedAsync();

            Assert.Equal(0, handler.Calls);
        }

        [Fact]
        public async Task Should_fill_only_the_days_that_have_no_rate()
        {
            var gapStart = this.today.AddDays(-10);
            this.StoreEveryDay(skipExchangeRates: day =>
                day >= gapStart && day < this.today.AddDays(-7)
            );

            var handler = new RoutingHandler
            {
                ArgentinaDatos = DailyRatesPayload(
                    (this.today.AddDays(-11), 1400),
                    (this.today.AddDays(-10), 1510),
                    (this.today.AddDays(-9), 1520),
                    (this.today.AddDays(-8), 1530)
                ),
            };

            await this.CreateSut(handler).SeedAsync();

            var blue = await this.context.ExchangeRates.Where(r => r.Type == "blue").ToListAsync();

            // One row per day, and the stored day before the gap keeps its own value.
            Assert.Equal(90, blue.Count);
            Assert.Equal(
                1500m,
                blue.Single(r => r.RecordedAt.Date == this.today.AddDays(-11)).Sell
            );
            Assert.Equal(1510m, blue.Single(r => r.RecordedAt.Date == gapStart).Sell);
            Assert.Equal(1530m, blue.Single(r => r.RecordedAt.Date == this.today.AddDays(-8)).Sell);
        }

        [Fact]
        public async Task Should_store_each_missing_crypto_day_once_at_that_days_blue_rate()
        {
            var gapDay = this.today.AddDays(-3);
            this.StoreEveryDay();
            await this
                .context.CryptoRates.Where(r =>
                    r.Symbol == "BTC" && r.RecordedAt >= gapDay && r.RecordedAt < gapDay.AddDays(1)
                )
                .ExecuteDeleteAsync();

            var handler = new RoutingHandler
            {
                CoinGecko = MarketChartPayload(
                    (gapDay.AddHours(1), 70_000),
                    (gapDay.AddHours(12), 71_000),
                    (gapDay.AddHours(23), 72_000)
                ),
            };

            await this.CreateSut(handler).SeedAsync();

            var filled = await this
                .context.CryptoRates.Where(r =>
                    r.Symbol == "BTC" && r.RecordedAt >= gapDay && r.RecordedAt < gapDay.AddDays(1)
                )
                .SingleAsync();

            Assert.Equal(72_000m, filled.PriceUsd);
            Assert.Equal(72_000m * 1500m, filled.PriceArs);
        }
    }

    public sealed class RoutingHandler : HttpMessageHandler
    {
        public string ArgentinaDatos { get; init; } = "[]";
        public string CoinGecko { get; init; } = """{"prices":[]}""";
        public int Calls { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        )
        {
            this.Calls++;
            var payload = request.RequestUri!.Host.Contains("argentinadatos")
                ? this.ArgentinaDatos
                : this.CoinGecko;

            return Task.FromResult(
                new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(payload, Encoding.UTF8, "application/json"),
                }
            );
        }
    }
}
