import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { RateTypeContent, RATE_TYPES, rateTypeBySlug } from '../../core/data/rate-types.data';

@Component({
  selector: 'app-rate-detail',
  imports: [DecimalPipe, RouterLink, BaseChartDirective],
  templateUrl: './rate-detail.component.html',
})
export class RateDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);
  private readonly ratesService = inject(RatesService);
  private readonly seo = inject(SeoService);
  private readonly theme = inject(ThemeService);

  readonly content = signal<RateTypeContent>(RATE_TYPES[0]);
  readonly history = signal<ExchangeRate[]>([]);
  readonly historyLoading = signal(true);
  readonly selectedDays = signal(30);
  readonly dayOptions = [7, 30, 90];

  readonly rates$ = this.store.select(selectExchangeRates);
  private readonly ratesSig = toSignal(this.rates$, { initialValue: [] as ExchangeRate[] });

  readonly rate = computed(() => this.ratesSig().find((r) => r.type === this.content().apiType));

  readonly oficial = computed(() => this.ratesSig().find((r) => r.type === 'oficial'));

  readonly gapWithOficial = computed(() => {
    const rate = this.rate();
    const oficial = this.oficial();
    if (!rate || !oficial?.sell || rate.type === 'oficial') return null;
    return ((rate.sell - oficial.sell) / oficial.sell) * 100;
  });

  readonly relatedTypes = computed(() =>
    this.content()
      .related.map((slug) => rateTypeBySlug(slug))
      .filter((r): r is RateTypeContent => !!r),
  );

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
          borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.15)',
          borderWidth: 1,
          titleColor: '#94a3b8',
          bodyColor: '#f8fafc',
          padding: 10,
          displayColors: false,
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

  ngOnInit() {
    this.route.data.subscribe((data) => {
      const content = rateTypeBySlug((data['slug'] as string) ?? '');
      if (!content) return;

      this.content.set(content);
      this.applySeo(content);
      this.store.dispatch(loadRates());
      this.loadHistory();
    });
  }

  ngOnDestroy() {
    this.seo.removeJsonLd('rate-faq');
  }

  onDaysChange(days: number) {
    this.selectedDays.set(days);
    this.loadHistory();
  }

  buildChartData(history: ExchangeRate[]): ChartConfiguration['data'] {
    const sorted = [...history].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );

    const byDay = new Map<string, number>();
    for (const r of sorted) {
      const day = new Date(r.recordedAt).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
      });
      byDay.set(day, r.sell);
    }

    const entries = [...byDay.entries()];
    const color = this.content().chartColor;

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

  private loadHistory() {
    this.historyLoading.set(true);
    this.ratesService.getHistory(this.content().apiType, this.selectedDays()).subscribe({
      next: (data) => {
        this.history.set(data);
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  private applySeo(content: RateTypeContent) {
    this.seo.update({
      title: content.metaTitle,
      description: content.metaDescription,
      path: `/${content.slug}`,
    });

    this.seo.setJsonLd('rate-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: content.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    });
  }
}
