# Dólar en Vivo

> A real-time financial dashboard that tracks Argentine exchange rates and crypto, and calculates actual portfolio returns adjusted for inflation — solving a real problem in a multi-currency economy.

![.NET](https://img.shields.io/badge/.NET-10.0-512BD4?logo=dotnet)
![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular)
[![API Build](https://github.com/patriciocarestia/dolar-en-vivo/actions/workflows/backend.yml/badge.svg)](https://github.com/patriciocarestia/dolar-en-vivo/actions/workflows/backend.yml)
[![Web Build](https://github.com/patriciocarestia/dolar-en-vivo/actions/workflows/frontend.yml/badge.svg)](https://github.com/patriciocarestia/dolar-en-vivo/actions/workflows/frontend.yml)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite)

**[Live Demo](https://www.dolarenvivo.com.ar/)** · **[API Docs](https://finsight-ai-api.azurewebsites.net/swagger)**

---

## Screenshots

### Dashboard

![Dashboard](./docs/dashboard.png)

### Portfolio

![Portfolio](./docs/portfolio.png)

### AI Analysis

![AI Analysis](./docs/analysis.png)

---

## The Problem

Argentina has multiple parallel exchange rates (Oficial, Blue, MEP, CCL, Cripto), each with different legality and accessibility. Investors need to track holdings across ARS cash, USD blue, USDT, crypto, and Plazos Fijos — then compare returns against inflation (historically ~140%/year). No single tool does this.

---

## Features

- **Live exchange rates** — Dólar Oficial, Blue, MEP, CCL, Cripto refreshed every 15 minutes
- **Crypto prices** — BTC and ETH in both USD and ARS
- **Historical charts** — 7d / 30d / 90d price history with interactive charts
- **Portfolio tracker** — add positions in any asset type with purchase price and date
- **AI analysis** — Gemini 2.5 Flash analyzes your portfolio in Spanish, comparing returns vs inflation and USD Blue
- **JWT authentication** — secure per-user portfolio data
- **Plazo fijo vs dólar calculator** — compares a fixed-term deposit against the real blue-dollar series over the same window
- **37 prerendered pages** — per-rate guides, programmatic conversion pages and historical tables, built for organic search

---

## Running locally

**Prerequisites:** [.NET 10 SDK](https://dotnet.microsoft.com/download), [Node.js 20+](https://nodejs.org/)

```bash
git clone https://github.com/patriciocarestia/dolar-en-vivo.git
cd dolar-en-vivo
```

**Backend** — starts on `http://localhost:5255`:

```bash
cd src/DolarEnVivo.API
cp appsettings.Development.example.json appsettings.Development.json
dotnet run
```

The database is created automatically on first run, and a few seconds after startup
the backfill loads 90 days of daily history from ArgentinaDatos and CoinGecko, so the
charts have data right away. The AI
analysis endpoint needs a [Gemini API key](https://aistudio.google.com/apikey)
in `appsettings.Development.json`; every other feature works without one.

**Frontend** — starts on `http://localhost:4200`:

```bash
cd client
npm install
npm start
```

**Tests:**

```bash
dotnet test dolar-en-vivo.sln   # backend
cd client && npm test           # frontend
```

---

## Tech Stack

| Layer    | Technology                                                    |
|----------|---------------------------------------------------------------|
| Frontend | Angular 21, TypeScript, NgRx, Signals, Tailwind CSS, Chart.js |
| Backend  | .NET 10, C#, Clean Architecture, MediatR (CQRS)               |
| Database | SQLite (EF Core code-first)                                   |
| AI       | Google Gemini 2.5 Flash                                       |
| Jobs     | Hangfire (in-process scheduled jobs)                          |
| Auth     | JWT Bearer tokens                                             |
| Testing  | xUnit + Moq (backend), Jest (frontend)                        |
| CI/CD    | GitHub Actions                                                |
| Hosting  | Azure Static Web Apps + Azure App Service F1                  |

---

## Architecture

```
┌─────────────────────────────────┐
│         Angular 21 SPA          │
│  NgRx Store · Signals · Charts  │
└────────────────┬────────────────┘
                 │ HTTP + JWT
┌────────────────▼────────────────┐
│       ASP.NET Core Web API      │
│  Controllers → MediatR → CQRS   │
├─────────────────────────────────┤
│ Application Layer (Use Cases)   │
│  Commands · Queries · Handlers  │
├─────────────────────────────────┤
│ Infrastructure Layer            │
│ EF Core · Repositories ·        │
│ DolarAPI · CoinGecko · Gemini   │
├─────────────────────────────────┤
│ SQLite Database                 │
└─────────────────────────────────┘
         ▲
  Hangfire (every 15 min) ─┐
  GitHub Actions cron ─────┼─→ fetch & store rates
  Any read of stale data ──┘
```

---

## API Endpoints

| Method | Route                                  | Auth | Description                     |
|--------|----------------------------------------|------|---------------------------------|
| POST   | `/api/auth/register`                   | 🔓   | Create account                  |
| POST   | `/api/auth/login`                      | 🔓   | Get JWT token                   |
| GET    | `/api/rates/latest`                    | 🔓   | Current exchange + crypto rates |
| GET    | `/api/rates/history?type=blue&days=30` | 🔓   | Historical rate data            |
| POST   | `/api/rates/refresh`                   | 🔓   | Refresh rates if they are stale |
| GET    | `/api/health`                          | 🔓   | Status plus the age of the data |
| GET    | `/api/portfolio`                       | ✅   | User's positions                |
| POST   | `/api/portfolio`                       | ✅   | Add position                    |
| PUT    | `/api/portfolio/{id}`                  | ✅   | Update position                 |
| DELETE | `/api/portfolio/{id}`                  | ✅   | Delete position                 |
| POST   | `/api/analysis`                        | ✅   | Trigger AI analysis             |

---

## Keeping the rates fresh

The API runs on an App Service free tier, which has no Always On: the host unloads the
process between visitors. An in-process scheduler only fires while the app happens to be
running, so a 15-minute cron can go weeks without a single tick — the site keeps answering
instantly, just with old numbers.

Freshness therefore does not depend on the scheduler. Three paths converge on the same
guarded fetch, and any one of them is enough:

- **Reads.** Serving `/api/rates/latest` is proof the app is awake, so a read whose newest
  record is over 15 minutes old refreshes before answering.
- **An external cron.** The `API Warmup` workflow wakes the app, calls
  `/api/rates/refresh`, and fails the run when `/api/health` still reports `stale`, so a
  silent outage shows up as a failed workflow instead of going unnoticed.
- **Hangfire**, unchanged, for whenever the app does stay warm.

Whole days can still go missing if nobody wakes the app for a day. Each startup
backfills them in the background: it checks the 90-day chart window for days with no
record and fills them with that day's close from ArgentinaDatos and CoinGecko. When
nothing is missing it makes no upstream calls.

All three refresh paths collapse into one upstream call: refreshing is a no-op while the data is
current, concurrent callers wait on a single gate, and a failed attempt backs off for two
minutes rather than hammering a provider that is down. `/api/health` reports
`latestRateAt`, `ageMinutes` and `stale`, so the age of the data is visible from outside.

On Azure, point both SQLite files at `/home/data`, which survives deployments and
restarts, via these app settings:

```
ConnectionStrings__DefaultConnection = Data Source=/home/data/dolarenvivo.db
ConnectionStrings__HangfireConnection = /home/data/hangfire.db
```

Note that Hangfire's SQLite storage takes a **file path**, not a connection string.

---

## Project Structure

```
dolar-en-vivo/
├── src/
│   ├── DolarEnVivo.API/             # Controllers, middleware, DI composition
│   ├── DolarEnVivo.Application/     # Use cases: commands, queries, handlers
│   ├── DolarEnVivo.Domain/          # Entities, no external dependencies
│   ├── DolarEnVivo.Infrastructure/  # EF Core, repositories, external APIs
│   └── DolarEnVivo.Tests/
└── client/                          # Angular 21 SPA
    ├── scripts/                     # sitemap generation (post-build)
    └── src/app/
        ├── core/                    # services, guards, interceptors, page content
        ├── features/                # routed pages, lazily loaded
        ├── shared/                  # reusable components
        └── store/                   # NgRx feature stores
```

---

## Rendering strategy

Pages are prerendered per route rather than served as a single client-rendered
bundle, since organic search is the main acquisition channel:

| Route | Mode | Why |
|-------|------|-----|
| `/`, `/dolar-*`, `/convertir/*`, `/historico/*` | Prerender (SSG) | Crawlers get real HTML on first request instead of waiting on the render queue |
| `/portfolio`, `/analysis` | Client | Behind an auth guard that reads `localStorage`, which doesn't exist at build time |

Prerendered rate data is a build-time snapshot, so the dashboard refetches
shortly after hydration and self-corrects rather than showing a stale number.

`sitemap.xml` is generated from the prerender output after each build, so it
lists exactly the pages that exist and can't drift from the routing table.

---

## Future Improvements

- Price alerts
- Portfolio performance over time
- Export to CSV/PDF
- Support for CEDEARs and acciones argentinas
- Social comparison (anonymous benchmarks)

---

Built by [Patricio Carestia](https://www.linkedin.com/in/patriciocarestia/) · Full Stack Engineer · Argentina
