import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { loadRates } from '../../store/rates/rates.actions';
import { selectExchangeRates } from '../../store/rates/rates.selectors';
import { ExchangeRate } from '../../store/rates/rates.model';
import { RatesService } from '../../core/services/rates.service';
import { SeoService } from '../../core/services/seo.service';
import { ThemeService } from '../../core/services/theme.service';
import { RATE_TYPES } from '../../core/data/rate-types.data';
import { forkJoin } from 'rxjs';

interface GapRow {
  slug: string;
  label: string;
  sell: number;
  gap: number;
}

@Component({
  selector: 'app-brecha',
  imports: [DecimalPipe, RouterLink, BaseChartDirective],
  templateUrl: './brecha.component.html',
})
export class BrechaComponent implements OnInit, OnDestroy {
  private readonly store = inject(Store);
  private readonly ratesService = inject(RatesService);
  private readonly seo = inject(SeoService);
  private readonly theme = inject(ThemeService);

  readonly historyLoading = signal(true);
  readonly gapHistory = signal<{ label: string; gap: number }[]>([]);

  private readonly ratesSig = toSignal(this.store.select(selectExchangeRates), {
    initialValue: [] as ExchangeRate[],
  });

  readonly oficial = computed(() => this.ratesSig().find((r) => r.type === 'oficial'));

  readonly rows = computed<GapRow[]>(() => {
    const oficial = this.oficial();
    if (!oficial?.sell) return [];

    return RATE_TYPES.filter((t) => t.apiType !== 'oficial')
      .map((type) => {
        const rate = this.ratesSig().find((r) => r.type === type.apiType);
        if (!rate?.sell) return null;
        return {
          slug: type.slug,
          label: type.label,
          sell: rate.sell,
          gap: ((rate.sell - oficial.sell) / oficial.sell) * 100,
        };
      })
      .filter((row): row is GapRow => row !== null)
      .sort((a, b) => b.gap - a.gap);
  });

  readonly blueGap = computed(() => this.rows().find((r) => r.slug === 'dolar-blue')?.gap ?? null);

  readonly chartOptions = computed((): ChartConfiguration['options'] => {
    const dark = this.theme.isDark();
    const grid = dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.07)';
    return {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: dark ? 'rgba(24,24,27,0.95)' : 'rgba(15,23,42,0.88)',
          borderWidth: 1,
          titleColor: '#94a3b8',
          bodyColor: '#f8fafc',
          padding: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) => `Brecha ${(ctx.parsed.y ?? 0).toFixed(1)}%`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 11 } },
          grid: { color: grid },
          border: { color: grid },
        },
        y: {
          beginAtZero: false,
          grace: '12%',
          ticks: { color: '#64748b', font: { size: 11 } },
          grid: { color: grid },
          border: { color: grid },
        },
      },
    };
  });

  readonly chartData = computed((): ChartConfiguration['data'] => {
    const history = this.gapHistory();
    return {
      labels: history.map((h) => h.label),
      datasets: [
        {
          data: history.map((h) => h.gap),
          borderColor: '#3b82f6',
          backgroundColor: '#3b82f612',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 1.5,
        },
      ],
    };
  });

  ngOnInit() {
    this.seo.update({
      title: 'Brecha Cambiaria Hoy: Dólar Blue vs Oficial | Dólar en Vivo',
      description:
        'Brecha cambiaria hoy entre el dólar blue y el oficial en Argentina. Cálculo actualizado en vivo, evolución histórica y comparación con MEP, CCL y cripto.',
      path: '/brecha-cambiaria',
    });

    this.seo.setJsonLd('brecha-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: '¿Qué es la brecha cambiaria?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Es la diferencia porcentual entre un tipo de cambio paralelo (como el dólar blue) y el dólar oficial. Se calcula como (paralelo − oficial) / oficial × 100 e indica cuánto más caro está el dólar fuera del circuito regulado.',
          },
        },
        {
          '@type': 'Question',
          name: '¿Por qué es importante la brecha cambiaria?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Es uno de los indicadores más seguidos de la economía argentina. Una brecha amplia refleja tensión cambiaria y expectativas de devaluación, mientras que una brecha baja sugiere mayor equilibrio entre la oferta y la demanda de divisas.',
          },
        },
        {
          '@type': 'Question',
          name: '¿Cómo se calcula la brecha entre el blue y el oficial?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Se resta el valor del dólar oficial al del blue, se divide por el oficial y se multiplica por cien. Por ejemplo, si el blue está a $1.565 y el oficial a $1.510, la brecha es de aproximadamente 3,6%.',
          },
        },
      ],
    });

    this.store.dispatch(loadRates());
    this.loadGapHistory();
  }

  ngOnDestroy() {
    this.seo.removeJsonLd('brecha-faq');
  }

  private loadGapHistory() {
    this.historyLoading.set(true);
    forkJoin({
      blue: this.ratesService.getHistory('blue', 90),
      oficial: this.ratesService.getHistory('oficial', 90),
    }).subscribe({
      next: ({ blue, oficial }) => {
        // Index the official rate by day so each blue point is compared against
        // the official value of that same day rather than today's.
        const oficialByDay = new Map<string, number>();
        for (const rate of oficial) {
          oficialByDay.set(this.dayKey(rate.recordedAt), rate.sell);
        }

        const points = blue
          .map((rate) => {
            const key = this.dayKey(rate.recordedAt);
            const oficialSell = oficialByDay.get(key);
            if (!oficialSell) return null;
            return {
              date: new Date(rate.recordedAt).getTime(),
              label: new Date(rate.recordedAt).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
              }),
              gap: ((rate.sell - oficialSell) / oficialSell) * 100,
            };
          })
          .filter((p): p is { date: number; label: string; gap: number } => p !== null)
          .sort((a, b) => a.date - b.date)
          .map(({ label, gap }) => ({ label, gap }));

        this.gapHistory.set(points);
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  private dayKey(iso: string): string {
    return new Date(iso).toISOString().slice(0, 10);
  }
}
