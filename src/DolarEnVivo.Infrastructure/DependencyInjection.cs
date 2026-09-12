using DolarEnVivo.Application.Interfaces;
using DolarEnVivo.Infrastructure.AI;
using DolarEnVivo.Infrastructure.Data;
using DolarEnVivo.Infrastructure.ExternalApis;
using DolarEnVivo.Infrastructure.Repositories;
using DolarEnVivo.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DolarEnVivo.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlite(configuration.GetConnectionString("DefaultConnection"))
        );

        services.AddMemoryCache();

        services.AddScoped<IPositionRepository, PositionRepository>();
        services.AddScoped<IRateRepository, RateRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IJwtService, JwtService>();
        services.AddScoped<RatesFetcherService>();
        services.AddScoped<IRateRefreshService>(sp => sp.GetRequiredService<RatesFetcherService>());
        services.AddScoped<HistoricalDataSeeder>();

        services.AddHttpClient<DolarApiClient>();
        services.AddHttpClient<CoinGeckoClient>(client =>
            client.DefaultRequestHeaders.Add("User-Agent", "DolarEnVivo/1.0 (portfolio tracker)")
        );
        services.AddHttpClient<IGeminiClient, GeminiClient>();

        return services;
    }
}
