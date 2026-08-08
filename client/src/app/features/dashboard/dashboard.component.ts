import {
  Component,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { RouterLink } from '@angular/router';
import { AsyncPipe, DecimalPipe, DatePipe, isPlatformBrowser } from '@angular/common';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { timer } from 'rxjs';
import { RateCardComponent } from '../../shared/components/rate-card/rate-card.component';
import { loadRates, loadHistory } from '../../store/rates/rates.actions';
import {
  selectExchangeRates,
  selectCryptoRates,
  selectRatesHistory,
  selectRatesLoading,
  selectLastFetched,
} from '../../store/rates/rates.selectors';
import { ExchangeRate, CryptoRate } from '../../store/rates/rates.model';
import { ThemeService } from '../../core/services/theme.service';
import { SeoService } from '../../core/services/seo.service';
import { RatesService } from '../../core/services/rates.service';
import { RATE_TYPES } from '../../core/data/rate-types.data';

const RATE_LABELS: Record<string, string> = {
  oficial: 'Dólar Oficial',
  blue: 'Dólar Blue',
  mep: 'Dólar MEP',
  ccl: 'Dólar CCL',
  cripto: 'Dólar Cripto',
};

const RATE_CHART_COLORS: Record<string, string> = {
  blue: '#3b82f6',
  oficial: '#22c55e',
  mep: '#a855f7',
  ccl: '#ec4899',
  cripto: '#f59e0b',
  BTC: '#f7931a',
  ETH: '#8b5cf6',
};

const CRYPTO_HISTORY_TYPES = ['BTC', 'ETH'];

const VIEW_MODE_KEY = 'dolarenvivo-view-mode';

// How old the prerendered/transfer-cached snapshot can be before we hide it
// behind the skeleton and wait for a real fetch, instead of showing stale numbers.
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

@Component({
  selector: 'app-dashboard',
  imports: [AsyncPipe, DecimalPipe, DatePipe, RateCardComponent, BaseChartDirective, RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  /** Drives the "guías" links, so the hub always points at every rate page. */
  readonly rateTypes = RATE_TYPES;

  private readonly store = inject(Store);
  private readonly theme = inject(ThemeService);
  private readonly seo = inject(SeoService);
  private readonly ratesService = inject(RatesService);

  readonly exchangeRates$ = this.store.select(selectExchangeRates);
  readonly cryptoRates$ = this.store.select(selectCryptoRates);
  readonly history$ = this.store.select(selectRatesHistory);
  readonly loading$ = this.store.select(selectRatesLoading);
  readonly lastFetched$ = this.store.select(selectLastFetched);

  // Single source of truth for the freshness gate: every template block that
  // needs to know "do we have live-enough data" reads these same signals
  // instead of subscribing to the store selectors independently, which could
  // leave sibling @if blocks evaluating the same check to different values
  // within the same render.
  private readonly exchangeRatesSig = toSignal(this.exchangeRates$, {
    initialValue: [] as ExchangeRate[],
  });
  private readonly cryptoRatesSig = toSignal(this.cryptoRates$, {
    initialValue: [] as CryptoRate[],
  });
  readonly rates = this.exchangeRatesSig;
  readonly cryptos = this.cryptoRatesSig;
  readonly lastFetched = toSignal(this.lastFetched$, { initialValue: null as string | null });

  // The client bootstraps with an empty store — even though the server had
  // real data at prerender time, the client's own toSignal()s start at their
  // initialValue (empty array / null) until ngOnInit's loadRates() actually
  // round-trips to the API (roughly 1s in practice). If we gate the hero
  // section on that data being present, it briefly reads as "not fresh" the
  // instant hydration finishes, so Angular hides the just-hydrated real
  // cards and shows the skeleton at the same time it's still tearing them
  // down. `settled` stays false long enough to cover that real fetch, so we
  // keep trusting the server's version until the client has actually caught
  // up, instead of judging it against data we know isn't loaded yet.
  private readonly settled = signal(false);
  readonly fresh = computed(() => !this.settled() || this.isFresh(this.lastFetched()));

  readonly dayOptions = [7, 30, 90];
  readonly selectedDays = signal(30);
  selectedType = 'blue';

  readonly cryptoHistory = signal<CryptoRate[]>([]);
  readonly cryptoHistoryLoading = signal(false);

  readonly converterAmount = signal(100);
  readonly converterType = signal('blue');
  readonly converterDirection = signal<'arsToUsd' | 'usdToArs'>('arsToUsd');

  readonly viewMode = signal<'cards' | 'table'>(this.readInitialViewMode());
  readonly shareCopied = signal(false);

  readonly chartOptions = computed((): ChartConfiguration['options'] => {
    const dark = this.theme.isDark();
    const grid = dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.07)';
    const tick = dark ? '#64748b' : '#64748b';
    const tooltipBg = dark ? 'rgba(24,24,27,0.95)' : 'rgba(15,23,42,0.88)';
    const tooltipBody = dark ? '#f8fafc' : '#f8fafc';

    return {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: tooltipBg,
          borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.15)',
          borderWidth: 1,
          titleColor: '#94a3b8',
          bodyColor: tooltipBody,
          padding: 10,
          displayColors: false,
        },
      },
      scales: {
        x: {
          ticks: { color: tick, maxTicksLimit: 8, font: { size: 11 } },
          grid: { color: grid },
          border: { color: grid },
        },
        y: {
          beginAtZero: false,
          grace: '12%',
          ticks: { color: tick, font: { size: 11 } },
          grid: { color: grid },
          border: { color: grid },
        },
      },
    };
  });

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      // 1.5s comfortably covers the real round-trip ngOnInit's loadRates()
      // needs to resolve (~1s in practice), so `settled` only flips once the
      // client has actually had a chance to catch up with the server.
      timer(1500)
        .pipe(takeUntilDestroyed())
        .subscribe(() => this.settled.set(true));

      // Short initial delay lets hydration settle (and the transfer-cached
      // first response render) before forcing a real network refresh, so the
      // build-time snapshot self-corrects within seconds instead of waiting
      // a full 5 minutes for the first live fetch.
      timer(3000, 5 * 60 * 1000)
        .pipe(takeUntilDestroyed())
        .subscribe(() => this.store.dispatch(loadRates()));
    }

    effect(() => {
      const rates = this.exchangeRatesSig();
      const cryptos = this.cryptoRatesSig();
      const items = this.faqItems(rates, cryptos);
      // More than the one static item means real rate data has arrived.
      if (items.length > 1) {
        this.seo.setJsonLd('faq', this.buildFaqSchema(items));
      }
    });
  }

  ngOnInit() {
    this.store.dispatch(loadRates());
    this.loadHistory();
  }

  ngOnDestroy() {
    this.seo.removeJsonLd('faq');
  }

  faqItems(rates: ExchangeRate[], cryptos: CryptoRate[]): { question: string; answer: string }[] {
    const blue = this.findRate(rates, 'blue');
    const oficial = this.findRate(rates, 'oficial');
    const btc = this.findCrypto(cryptos, 'BTC');
    const gap = this.gapPercent(rates);
    const items: { question: string; answer: string }[] = [];

    if (blue) {
      items.push({
        question: '¿A cuánto está el dólar blue hoy?',
        answer: `El dólar blue hoy cotiza a $${this.formatNumber(blue.buy)} para la compra y $${this.formatNumber(blue.sell)} para la venta.`,
      });
      items.push({
        question: '¿El dólar blue es lo mismo que el dólar paralelo o informal?',
        answer:
          'Sí, dólar blue, dólar paralelo y dólar informal son la misma cotización: el precio del dólar fuera del circuito oficial.',
      });
    }
    if (oficial) {
      items.push({
        question: '¿A cuánto está el dólar oficial hoy?',
        answer: `El dólar oficial hoy cotiza a $${this.formatNumber(oficial.buy)} para la compra y $${this.formatNumber(oficial.sell)} para la venta.`,
      });
    }
    if (gap !== null) {
      items.push({
        question: '¿Cuál es la brecha entre el dólar blue y el oficial?',
        answer: `La brecha cambiaria entre el dólar blue y el dólar oficial es del ${Math.round(gap)}% en este momento.`,
      });
    }
    if (btc) {
      items.push({
        question: '¿Cuánto vale el Bitcoin en pesos argentinos?',
        answer: `1 Bitcoin equivale hoy a $${this.formatNumber(btc.priceArs)} pesos argentinos (USD ${this.formatNumber(btc.priceUsd)}).`,
      });
    }
    items.push({
      question: '¿Cada cuánto se actualizan las cotizaciones en Dólar en Vivo?',
      answer:
        'Las cotizaciones del dólar y las criptomonedas se actualizan automáticamente cada pocos minutos, las 24 horas.',
    });

    return items;
  }

  onRefresh() {
    this.store.dispatch(loadRates());
    this.loadHistory();
  }

  onTypeChange(type: string) {
    this.selectedType = type;
    this.loadHistory();
  }

  onDaysChange(days: number) {
    this.selectedDays.set(days);
    this.loadHistory();
  }

  setViewMode(mode: 'cards' | 'table') {
    this.viewMode.set(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* localStorage unavailable (private mode, etc.) */
    }
  }

  getRateLabel(type: string): string {
    return RATE_LABELS[type] ?? type;
  }

  isFresh(lastFetched: string | null): boolean {
    if (!lastFetched) return false;
    return Date.now() - new Date(lastFetched).getTime() < STALE_THRESHOLD_MS;
  }

  findRate(rates: ExchangeRate[], type: string): ExchangeRate | undefined {
    return rates.find((r) => r.type === type);
  }

  otherRates(rates: ExchangeRate[]): ExchangeRate[] {
    return rates.filter((r) => r.type !== 'blue' && r.type !== 'oficial');
  }

  gapPercent(rates: ExchangeRate[]): number | null {
    const blue = this.findRate(rates, 'blue');
    const oficial = this.findRate(rates, 'oficial');
    if (!blue || !oficial || !oficial.sell) return null;
    return ((blue.sell - oficial.sell) / oficial.sell) * 100;
  }

  findCrypto(cryptos: CryptoRate[], symbol: string): CryptoRate | undefined {
    return cryptos.find((c) => c.symbol.toUpperCase() === symbol);
  }

  chartColor(type: string): string {
    return RATE_CHART_COLORS[type] ?? '#6366f1';
  }

  setConverterAmount(value: string) {
    this.converterAmount.set(Number(value) || 0);
  }

  setConverterType(value: string) {
    this.converterType.set(value);
  }

  swapConverterDirection() {
    this.converterDirection.set(this.converterDirection() === 'arsToUsd' ? 'usdToArs' : 'arsToUsd');
  }

  convertedValue(rates: ExchangeRate[]): number | null {
    const rate = this.findRate(rates, this.converterType());
    if (!rate || !rate.sell) return null;

    return this.converterDirection() === 'arsToUsd'
      ? this.converterAmount() / rate.sell
      : this.converterAmount() * rate.sell;
  }

  async onShare() {
    const rates = this.exchangeRatesSig();
    const cryptos = this.cryptoRatesSig();
    const blue = this.findRate(rates, 'blue');
    const oficial = this.findRate(rates, 'oficial');
    const btc = this.findCrypto(cryptos, 'BTC');

    const lines = [
      '💵 Cotizaciones en Argentina - Dólar en Vivo',
      blue ? `Dólar Blue: $${this.formatNumber(blue.sell)}` : null,
      oficial ? `Dólar Oficial: $${this.formatNumber(oficial.sell)}` : null,
      btc ? `Bitcoin: USD ${this.formatNumber(btc.priceUsd)}` : null,
    ].filter((line): line is string => !!line);

    const text = lines.join('\n');
    const url = typeof window !== 'undefined' ? window.location.href : '';

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Dólar en Vivo - Cotizaciones', text, url });
      } catch {
        /* user cancelled the share sheet */
      }
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      this.shareCopied.set(true);
      setTimeout(() => this.shareCopied.set(false), 2000);
    }
  }

  buildChartData(history: (ExchangeRate | CryptoRate)[]): ChartConfiguration['data'] {
    const isCrypto = this.isCryptoType(this.selectedType);
    const sorted = [...history].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );

    const byDay = new Map<string, number>();
    for (const r of sorted) {
      const day = new Date(r.recordedAt).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
      });
      byDay.set(day, isCrypto ? (r as CryptoRate).priceUsd : (r as ExchangeRate).sell);
    }

    const entries = [...byDay.entries()];
    const color = this.chartColor(this.selectedType);

    return {
      labels: entries.map(([day]) => day),
      datasets: [
        {
          data: entries.map(([, sell]) => sell),
          borderColor: color,
          backgroundColor: `${color}12`,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 1.5,
        },
      ],
    };
  }

  private formatNumber(n: number): string {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
  }

  private buildFaqSchema(items: { question: string; answer: string }[]) {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    };
  }

  private readInitialViewMode(): 'cards' | 'table' {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      return stored === 'table' ? 'table' : 'cards';
    } catch {
      return 'cards';
    }
  }

  isCryptoType(type: string): boolean {
    return CRYPTO_HISTORY_TYPES.includes(type);
  }

  private loadHistory() {
    if (this.isCryptoType(this.selectedType)) {
      this.cryptoHistoryLoading.set(true);
      this.ratesService.getCryptoHistory(this.selectedType, this.selectedDays()).subscribe({
        next: (data) => {
          this.cryptoHistory.set(data);
          this.cryptoHistoryLoading.set(false);
        },
        error: () => this.cryptoHistoryLoading.set(false),
      });
      return;
    }

    this.store.dispatch(loadHistory({ rateType: this.selectedType, days: this.selectedDays() }));
  }
}
