import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { SeoService } from './core/services/seo.service';
import { AnalyticsService } from './core/services/analytics.service';
import { environment } from '../environments/environment';
import { RATE_TYPES } from './core/data/rate-types.data';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, RouterLink],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  /**
   * Site-wide links in the footer. Present on every page, so each rate guide
   * and tool stays one hop from anywhere a crawler lands.
   */
  readonly footerLinks = [
    ...RATE_TYPES.map((type) => ({ path: `/${type.slug}`, label: type.label })),
    { path: '/brecha-cambiaria', label: 'Brecha cambiaria' },
    { path: '/convertir', label: 'Conversor' },
    { path: '/calculadora/plazo-fijo-vs-dolar', label: 'Plazo fijo vs dólar' },
  ];

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly analytics = inject(AnalyticsService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.http.get(`${environment.apiUrl}/health`).subscribe();

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => {
          let route = this.activatedRoute;
          while (route.firstChild) route = route.firstChild;
          return route.snapshot;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((snapshot) => {
        const title = (snapshot.data['title'] as string) ?? 'Dólar en Vivo';
        const description =
          (snapshot.data['description'] as string) ??
          'Cotización del dólar y criptomonedas en Argentina hoy, en vivo.';

        // Routes whose metadata depends on their params (a rate slug, a
        // conversion amount) set it from the component itself. Writing the
        // generic fallback here too would race with — and usually clobber —
        // the specific one the component just published.
        if (!snapshot.data['dynamicSeo']) {
          this.seo.update({ title, description, path: this.router.url });
        }
        this.analytics.trackPageView(this.router.url, title);
      });
  }
}
