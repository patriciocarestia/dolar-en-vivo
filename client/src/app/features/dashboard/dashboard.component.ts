import { Component, OnInit, OnDestroy, PLATFORM_ID, inject, signal, computed } from '@angular/core';
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

const CRYPTO_LABELS: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
};

const VIEW_MODE_KEY = 'dolarenvivo-view-mode';

const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const SETTLE_DELAY_MS = 1500;
const HYDRATION_GRACE_MS = 3000;

// Deliberately free of live figures: search engines cache this content for
// days, so a quoted rate would be served long after it stopped being true.
const FAQ_ITEMS: readonly { question: string; answer: string }[] = [
  {
    question: '¿Qué es el dólar blue?',
    answer:
      'Es el precio del dólar en el mercado informal, fuera del circuito bancario oficial. Se lo llama también dólar paralelo o informal: son la misma cotización. Su valor en vivo aparece en las tarjetas de esta página.',
  },
  {
    question: '¿En qué se diferencian el dólar oficial, el MEP y el CCL?',
    answer:
      'El oficial es el tipo de cambio regulado por el Banco Central. El MEP y el CCL surgen de comprar y vender bonos: el MEP deja los dólares en una cuenta local y el CCL los transfiere al exterior. Cada uno tiene su propia cotización, requisitos y costos.',
  },
  {
    question: '¿Qué es la brecha cambiaria?',
    answer:
      'Es la diferencia porcentual entre una cotización paralela y el dólar oficial. Cuanto más alta, mayor es la distancia entre el precio regulado y el que rige en el mercado libre.',
  },
  {
    question: '¿Qué es el dólar cripto?',
    answer:
      'Es el tipo de cambio que surge de comprar stablecoins como USDT o USDC con pesos. Opera las 24 horas, incluidos fines de semana y feriados, cuando el resto de los mercados está cerrado.',
  },
  {
    question: '¿Cada cuánto se actualizan las cotizaciones en Dólar en Vivo?',
    answer:
      'Las cotizaciones del dólar y las criptomonedas se actualizan automáticamente cada pocos minutos, las 24 horas.',
  },
];

@Component({
  selector: 'app-dashboard',
  imports: [AsyncPipe, DecimalPipe, DatePipe, RateCardComponent, BaseChartDirective, RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
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

  private readonly exchangeRatesSig = toSignal(this.exchangeRates$, {
    initialValue: [] as ExchangeRate[],
  });
  private readonly cryptoRatesSig = toSignal(this.cryptoRates$, {
    initialValue: [] as CryptoRate[],
  });
  readonly rates = this.exchangeRatesSig;
  readonly cryptos = this.cryptoRatesSig;
  readonly lastFetched = toSignal(this.lastFetched$, { initialValue: null as string | null });

  // Trust the prerendered values until the client's first fetch resolves;
  // judging freshness against the still-empty store would flash the skeleton
  // over cards that just hydrated.
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
      timer(SETTLE_DELAY_MS)
        .pipe(takeUntilDestroyed())
        .subscribe(() => this.settled.set(true));

      timer(HYDRATION_GRACE_MS, REFRESH_INTERVAL_MS)
        .pipe(takeUntilDestroyed())
        .subscribe(() => this.store.dispatch(loadRates()));
    }
  }

  ngOnInit() {
    this.seo.setJsonLd('faq', this.buildFaqSchema(FAQ_ITEMS));
    this.store.dispatch(loadRates());
    this.loadHistory();
  }

  ngOnDestroy() {
    this.seo.removeJsonLd('faq');
  }

  faqItems(): readonly { question: string; answer: string }[] {
    return FAQ_ITEMS;
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

  getCryptoLabel(symbol: string): string {
    return CRYPTO_LABELS[symbol.toUpperCase()] ?? symbol;
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

  private buildFaqSchema(items: readonly { question: string; answer: string }[]) {
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
