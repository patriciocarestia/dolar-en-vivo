import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { SeoService } from '../../core/services/seo.service';
import { CONVERSION_ROUTES, ConversionRoute } from '../../core/data/conversion.data';

@Component({
  selector: 'app-convert-hub',
  imports: [RouterLink, DecimalPipe],
  template: `
    <div class="space-y-8">
      <nav class="flex items-center gap-2 text-xs text-slate-600" aria-label="Migas de pan">
        <a routerLink="/" class="hover:text-slate-400 transition-colors">Cotizaciones</a>
        <span aria-hidden="true">›</span>
        <span class="text-slate-500">Conversor</span>
      </nav>

      <div>
        <h1 class="page-title">Conversor de dólares a pesos</h1>
        <p class="page-subtitle">
          Convertí cualquier monto según el dólar blue, oficial, MEP, CCL o cripto
        </p>
      </div>

      <section class="card">
        <div class="section-header">
          <h2>De dólares a pesos</h2>
          <div class="section-divider"></div>
        </div>
        <div class="flex flex-wrap gap-2">
          @for (item of usdToArs; track item.slug) {
            <a
              [routerLink]="['/convertir', item.slug]"
              class="day-pill hover:text-white transition-colors"
            >
              US$ {{ item.amount | number: '1.0-0' }}
            </a>
          }
        </div>
      </section>

      <section class="card">
        <div class="section-header">
          <h2>De pesos a dólares</h2>
          <div class="section-divider"></div>
        </div>
        <div class="flex flex-wrap gap-2">
          @for (item of arsToUsd; track item.slug) {
            <a
              [routerLink]="['/convertir', item.slug]"
              class="day-pill hover:text-white transition-colors"
            >
              \${{ item.amount | number: '1.0-0' }}
            </a>
          }
        </div>
      </section>

      <section class="card">
        <div class="section-header">
          <h2>Cómo funciona</h2>
          <div class="section-divider"></div>
        </div>
        <p class="text-sm text-slate-400 leading-relaxed">
          Cada conversión se calcula con las cotizaciones vigentes de los cinco tipos de cambio que
          operan en Argentina, actualizadas automáticamente. Elegí un monto de la lista para ver el
          detalle completo, o usá el conversor de cualquiera de esas páginas para calcular un valor
          distinto.
        </p>
      </section>
    </div>
  `,
})
export class ConvertHubComponent implements OnInit {
  private readonly seo = inject(SeoService);

  readonly usdToArs: ConversionRoute[] = CONVERSION_ROUTES.filter(
    (c) => c.direction === 'usd-to-ars',
  );
  readonly arsToUsd: ConversionRoute[] = CONVERSION_ROUTES.filter(
    (c) => c.direction === 'ars-to-usd',
  );

  ngOnInit() {
    this.seo.update({
      title: 'Conversor de Dólares a Pesos Argentinos | Dólar en Vivo',
      description:
        'Convertí dólares a pesos argentinos y viceversa según el dólar blue, oficial, MEP, CCL y cripto. Cotizaciones actualizadas en vivo.',
      path: '/convertir',
    });
  }
}
