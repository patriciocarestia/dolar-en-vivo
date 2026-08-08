import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { RatesService } from '../../core/services/rates.service';
import { SeoService } from '../../core/services/seo.service';
import { ExchangeRate } from '../../store/rates/rates.model';

const TERM_OPTIONS = [30, 60, 90];

@Component({
  selector: 'app-plazo-fijo-calculator',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './plazo-fijo.component.html',
})
export class PlazoFijoCalculatorComponent implements OnInit, OnDestroy {
  private readonly ratesService = inject(RatesService);
  private readonly seo = inject(SeoService);

  readonly termOptions = TERM_OPTIONS;

  readonly amount = signal(1_000_000);
  readonly tna = signal(35);
  readonly termDays = signal(30);

  /** Blue history, newest last, used as the "what if you'd bought dollars" leg. */
  private readonly history = signal<ExchangeRate[]>([]);
  readonly historyLoading = signal(true);

  /** Interest earned over the term, simple interest as banks quote it. */
  readonly plazoFijoInterest = computed(
    () => this.amount() * (this.tna() / 100) * (this.termDays() / 365),
  );

  readonly plazoFijoFinal = computed(() => this.amount() + this.plazoFijoInterest());

  /**
   * The same term measured against what the dollar actually did: we look back
   * `termDays` in the real blue series rather than projecting a rate forward,
   * so the comparison is grounded in observed data instead of a guess.
   */
  private readonly dollarWindow = computed(() => {
    const sorted = [...this.history()].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );
    if (sorted.length < 2) return null;

    const latest = sorted[sorted.length - 1];
    const cutoff = new Date(latest.recordedAt).getTime() - this.termDays() * 24 * 60 * 60 * 1000;

    // First point at or after the cutoff — the closest we have to "the rate
    // this many days ago".
    const start = sorted.find((r) => new Date(r.recordedAt).getTime() >= cutoff) ?? sorted[0];
    if (!start.sell || start === latest) return null;

    return { start: start.sell, end: latest.sell };
  });

  readonly dollarChangePercent = computed(() => {
    const window = this.dollarWindow();
    if (!window) return null;
    return ((window.end - window.start) / window.start) * 100;
  });

  /** What the same pesos would be worth today if converted to dollars at the start. */
  readonly dollarFinal = computed(() => {
    const window = this.dollarWindow();
    if (!window) return null;
    return (this.amount() / window.start) * window.end;
  });

  readonly dollarInterest = computed(() => {
    const final = this.dollarFinal();
    return final === null ? null : final - this.amount();
  });

  readonly winner = computed<'plazo-fijo' | 'dolar' | null>(() => {
    const dollar = this.dollarFinal();
    if (dollar === null) return null;
    return this.plazoFijoFinal() >= dollar ? 'plazo-fijo' : 'dolar';
  });

  readonly difference = computed(() => {
    const dollar = this.dollarFinal();
    if (dollar === null) return null;
    return Math.abs(this.plazoFijoFinal() - dollar);
  });

  /** Annualised dollar move, so it can be read next to the TNA on equal terms. */
  readonly dollarAnnualised = computed(() => {
    const change = this.dollarChangePercent();
    if (change === null) return null;
    return change * (365 / this.termDays());
  });

  ngOnInit() {
    this.seo.update({
      title: 'Plazo Fijo vs Dólar: Calculadora Comparativa | Dólar en Vivo',
      description:
        'Calculá si conviene un plazo fijo o comprar dólares. Compará el rendimiento de tu plazo fijo contra lo que hizo el dólar blue en el mismo período, con datos reales.',
      path: '/calculadora/plazo-fijo-vs-dolar',
    });

    this.seo.setJsonLd('plazo-fijo-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: '¿Conviene un plazo fijo o comprar dólares?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Depende de si la tasa del plazo fijo le gana a la suba del dólar en el mismo período. Si el dólar sube más que la tasa, el plazo fijo pierde en términos de poder de compra en dólares. Esta calculadora compara ambas opciones usando la evolución real del dólar blue.',
          },
        },
        {
          '@type': 'Question',
          name: '¿Cómo se calcula el rendimiento de un plazo fijo?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Se multiplica el capital por la TNA (tasa nominal anual) y se prorratea por los días del plazo: capital × TNA ÷ 365 × días. El resultado son los intereses que se cobran al vencimiento.',
          },
        },
        {
          '@type': 'Question',
          name: '¿Qué es la TNA de un plazo fijo?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'La TNA es la tasa nominal anual que paga el banco. No es lo que efectivamente cobrás en un mes: hay que prorratearla por la cantidad de días del plazo para saber el interés real del período.',
          },
        },
      ],
    });

    this.ratesService.getHistory('blue', 120).subscribe({
      next: (data) => {
        this.history.set(data);
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  ngOnDestroy() {
    this.seo.removeJsonLd('plazo-fijo-faq');
  }

  setAmount(value: string) {
    const parsed = Number(value);
    this.amount.set(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
  }

  setTna(value: string) {
    const parsed = Number(value);
    this.tna.set(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
  }

  setTerm(days: number) {
    this.termDays.set(days);
  }
}
