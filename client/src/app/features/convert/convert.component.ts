import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { loadRates } from '../../store/rates/rates.actions';
import { selectExchangeRates } from '../../store/rates/rates.selectors';
import { ExchangeRate } from '../../store/rates/rates.model';
import { SeoService } from '../../core/services/seo.service';
import { RATE_TYPES } from '../../core/data/rate-types.data';
import {
  CONVERSION_ROUTES,
  ConversionRoute,
  conversionBySlug,
  conversionMetaDescription,
  conversionMetaTitle,
  conversionTitle,
  relatedConversions,
} from '../../core/data/conversion.data';

interface ConversionRow {
  slug: string;
  label: string;
  lowerLabel: string;
  rate: number;
  result: number;
}

@Component({
  selector: 'app-convert',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './convert.component.html',
})
export class ConvertComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);
  private readonly seo = inject(SeoService);

  readonly conversion = signal<ConversionRoute>(CONVERSION_ROUTES[0]);
  readonly customAmount = signal<number | null>(null);

  private readonly ratesSig = toSignal(this.store.select(selectExchangeRates), {
    initialValue: [] as ExchangeRate[],
  });

  readonly heading = computed(() => conversionTitle(this.conversion()));
  readonly isUsdToArs = computed(() => this.conversion().direction === 'usd-to-ars');

  readonly activeAmount = computed(() => this.customAmount() ?? this.conversion().amount);

  readonly rows = computed<ConversionRow[]>(() => {
    const rates = this.ratesSig();
    const amount = this.activeAmount();
    const usdToArs = this.isUsdToArs();

    return RATE_TYPES.map((type) => {
      const rate = rates.find((r) => r.type === type.apiType);
      if (!rate?.sell) return null;
      return {
        slug: type.slug,
        label: type.label,
        lowerLabel: type.lowerLabel,
        rate: rate.sell,
        result: usdToArs ? amount * rate.sell : amount / rate.sell,
      };
    }).filter((row): row is ConversionRow => row !== null);
  });

  readonly headlineRow = computed(
    () => this.rows().find((row) => row.slug === 'dolar-blue') ?? this.rows()[0],
  );

  readonly related = computed(() => relatedConversions(this.conversion()));

  readonly oppositeDirection = computed(() => {
    const row = this.headlineRow();
    if (!row) return null;
    const target = this.isUsdToArs() ? row.result : row.result;
    const candidates = CONVERSION_ROUTES.filter((c) => c.direction !== this.conversion().direction);
    return candidates.reduce((closest, candidate) =>
      Math.abs(candidate.amount - target) < Math.abs(closest.amount - target) ? candidate : closest,
    );
  });

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const conversion = conversionBySlug(params.get('slug') ?? '');
      if (!conversion) return;

      this.conversion.set(conversion);
      this.customAmount.set(null);
      this.applySeo(conversion);
      this.store.dispatch(loadRates());
    });
  }

  ngOnDestroy() {
    this.seo.removeJsonLd('convert-faq');
  }

  setCustomAmount(value: string) {
    const parsed = Number(value);
    this.customAmount.set(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
  }

  private applySeo(conversion: ConversionRoute) {
    this.seo.update({
      title: conversionMetaTitle(conversion),
      description: conversionMetaDescription(conversion),
      path: `/convertir/${conversion.slug}`,
    });

    const formatted = new Intl.NumberFormat('es-AR').format(conversion.amount);
    const question =
      conversion.direction === 'usd-to-ars'
        ? `¿Cuánto son ${formatted} dólares en pesos argentinos?`
        : `¿Cuánto son ${formatted} pesos argentinos en dólares?`;
    const answer =
      conversion.direction === 'usd-to-ars'
        ? `El resultado depende del tipo de cambio: no es lo mismo convertir ${formatted} dólares al dólar blue que al oficial, al MEP, al CCL o al cripto. En esta página se muestra el equivalente en pesos según cada cotización, actualizado en vivo.`
        : `El resultado depende del tipo de cambio usado. En esta página se muestra cuántos dólares equivalen a $${formatted} según el dólar blue, oficial, MEP, CCL y cripto, con cotizaciones actualizadas en vivo.`;

    this.seo.setJsonLd('convert-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        },
      ],
    });
  }
}
