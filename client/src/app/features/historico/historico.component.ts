import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { RatesService } from '../../core/services/rates.service';
import { SeoService } from '../../core/services/seo.service';
import { ExchangeRate } from '../../store/rates/rates.model';
import { RATE_TYPES, RateTypeContent, rateTypeBySlug } from '../../core/data/rate-types.data';

interface MonthSummary {
  key: string;
  label: string;
  open: number;
  close: number;
  min: number;
  max: number;
  average: number;
  changePercent: number;
}

interface DayRow {
  label: string;
  buy: number;
  sell: number;
}

@Component({
  selector: 'app-historico',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './historico.component.html',
})
export class HistoricoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly ratesService = inject(RatesService);
  private readonly seo = inject(SeoService);

  readonly allTypes = RATE_TYPES;
  readonly content = signal<RateTypeContent>(RATE_TYPES[0]);
  readonly loading = signal(true);
  private readonly history = signal<ExchangeRate[]>([]);

  private readonly dailySeries = computed(() => {
    const byDay = new Map<string, ExchangeRate>();
    for (const rate of this.history()) {
      const key = new Date(rate.recordedAt).toISOString().slice(0, 10);
      byDay.set(key, rate);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, rate]) => ({ key, rate }));
  });

  readonly months = computed<MonthSummary[]>(() => {
    const groups = new Map<string, ExchangeRate[]>();
    for (const { key, rate } of this.dailySeries()) {
      const monthKey = key.slice(0, 7);
      const bucket = groups.get(monthKey);
      if (bucket) bucket.push(rate);
      else groups.set(monthKey, [rate]);
    }

    return [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, rates]) => {
        const sells = rates.map((r) => r.sell).filter((s) => s > 0);
        const open = sells[0];
        const close = sells[sells.length - 1];
        return {
          key,
          label: this.monthLabel(key),
          open,
          close,
          min: Math.min(...sells),
          max: Math.max(...sells),
          average: sells.reduce((sum, s) => sum + s, 0) / sells.length,
          changePercent: open ? ((close - open) / open) * 100 : 0,
        };
      });
  });

  readonly recentDays = computed<DayRow[]>(() =>
    [...this.dailySeries()]
      .reverse()
      .slice(0, 30)
      .map(({ key, rate }) => ({
        label: new Date(`${key}T12:00:00Z`).toLocaleDateString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        buy: rate.buy,
        sell: rate.sell,
      })),
  );

  readonly periodSummary = computed(() => {
    const series = this.dailySeries();
    if (series.length < 2) return null;
    const sells = series.map((s) => s.rate.sell).filter((s) => s > 0);
    if (sells.length < 2) return null;

    const open = sells[0];
    const close = sells[sells.length - 1];
    return {
      open,
      close,
      min: Math.min(...sells),
      max: Math.max(...sells),
      changePercent: ((close - open) / open) * 100,
      days: series.length,
    };
  });

  readonly otherTypes = computed(() => this.allTypes.filter((t) => t.slug !== this.content().slug));

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const content = rateTypeBySlug(params.get('slug') ?? '');
      if (!content) return;

      this.content.set(content);
      this.seo.update({
        title: `Histórico del ${content.label}: Cotización Día por Día | Dólar en Vivo`,
        description: `Cotización histórica del ${content.lowerLabel} en Argentina: valores día por día, máximos, mínimos y variación mensual.`,
        path: `/historico/${content.slug}`,
      });

      this.loading.set(true);
      this.ratesService.getHistory(content.apiType, 90).subscribe({
        next: (data) => {
          this.history.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    });
  }

  private monthLabel(key: string): string {
    const [year, month] = key.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    const name = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}
