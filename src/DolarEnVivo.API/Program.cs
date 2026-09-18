using System.Text;
using DolarEnVivo.API.Middleware;
using DolarEnVivo.Application;
using DolarEnVivo.Application.Interfaces;
using DolarEnVivo.Infrastructure;
using DolarEnVivo.Infrastructure.Data;
using DolarEnVivo.Infrastructure.Services;
using Hangfire;
using Hangfire.Storage.SQLite;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddMemoryCache();

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc(
        "v1",
        new OpenApiInfo
        {
            Title = "Dólar en Vivo API",
            Version = "v1",
            Description =
                "Real-time Argentine exchange rates, crypto tracker, and AI-powered portfolio analysis",
        }
    );

    c.AddSecurityDefinition(
        "Bearer",
        new OpenApiSecurityScheme
        {
            Name = "Authorization",
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            In = ParameterLocation.Header,
        }
    );

    c.AddSecurityRequirement(
        new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.SecurityScheme,
                        Id = "Bearer",
                    },
                },
                []
            },
        }
    );

    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
        c.IncludeXmlComments(xmlPath);
});

builder
    .Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)
            ),
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy(
        "AllowAngular",
        policy =>
        {
            var origins =
                builder
                    .Configuration["AllowedOrigins"]
                    ?.Split(
                        ',',
                        StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
                    ) ?? new[] { "http://localhost:4200" };

            policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
        }
    );
});

// Hangfire.Storage.SQLite takes a file path, not a connection string: handed
// "Data Source=hangfire.db" it creates a file with that literal name. Point this at a
// directory the host keeps across deployments so the scheduler does not lose its state.
var hangfireDatabasePath = ResolveSqliteFilePath(
    builder.Configuration.GetConnectionString("HangfireConnection") ?? "hangfire.db"
);

var hangfireDirectory = Path.GetDirectoryName(Path.GetFullPath(hangfireDatabasePath));
if (!string.IsNullOrEmpty(hangfireDirectory))
    Directory.CreateDirectory(hangfireDirectory);

builder.Services.AddHangfire(config => config.UseSQLiteStorage(hangfireDatabasePath));

static string ResolveSqliteFilePath(string connectionStringOrPath)
{
    const string dataSourcePrefix = "Data Source=";
    var value = connectionStringOrPath.Trim();

    return value.StartsWith(dataSourcePrefix, StringComparison.OrdinalIgnoreCase)
        ? value[dataSourcePrefix.Length..].Trim()
        : value;
}

builder.Services.AddHangfireServer();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

// Backfilling can take several upstream calls, and on a host that unloads the app the
// first visitor already waits out the cold start, so it runs once the server is up.
app.Lifetime.ApplicationStarted.Register(() =>
    _ = Task.Run(async () =>
    {
        using var scope = app.Services.CreateScope();
        try
        {
            var seeder = scope.ServiceProvider.GetRequiredService<HistoricalDataSeeder>();
            await seeder.SeedAsync(app.Lifetime.ApplicationStopping);
        }
        catch (Exception ex)
        {
            app.Logger.LogError(ex, "Historical backfill failed; will retry on next startup.");
        }
    })
);

app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseResponseCompression();

app.UseSwagger();
app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Dólar en Vivo v1"));

app.UseHttpsRedirection();
app.UseCors("AllowAngular");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.UseHangfireDashboard(
    "/hangfire",
    new DashboardOptions { Authorization = [new HangfireLocalFilter()] }
);

RecurringJob.AddOrUpdate<RatesFetcherService>(
    "fetch-rates",
    service => service.FetchAndStoreAllRatesAsync(),
    "*/15 * * * *"
);

RecurringJob.AddOrUpdate<RatesFetcherService>(
    "cleanup-old-rates",
    service => service.CleanupOldRatesAsync(),
    "0 3 * * *"
);

// Reports how old the stored rates are, not just whether the process answers. A page
// serving month-old figures used to look identical to a healthy one from the outside.
const double StaleAfterMinutes = 30;

app.MapGet(
        "/api/health",
        async (IRateRepository rates, CancellationToken cancellationToken) =>
        {
            var latest = await rates.GetLatestRateTimestampAsync(cancellationToken);
            var ageMinutes = latest is null
                ? (double?)null
                : Math.Round((DateTime.UtcNow - latest.Value).TotalMinutes, 1);

            return Results.Ok(
                new
                {
                    status = "ok",
                    latestRateAt = latest,
                    ageMinutes,
                    stale = ageMinutes is null || ageMinutes > StaleAfterMinutes,
                }
            );
        }
    )
    .AllowAnonymous();

app.Run();
