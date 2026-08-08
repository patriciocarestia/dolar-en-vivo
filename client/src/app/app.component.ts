import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ViewportScroller } from '@angular/common';
import {
  ActivatedRoute,
  NavigationEnd,
  NavigationStart,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { SeoService } from './core/services/seo.service';
import { AnalyticsService } from './core/services/analytics.service';
import { environment } from '../environments/environment';
import { RATE_TYPES } from './core/data/rate-types.data';

const DEFAULT_TITLE = 'Dólar en Vivo';
const DEFAULT_DESCRIPTION = 'Cotización del dólar y criptomonedas en Argentina hoy, en vivo.';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, RouterLink],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  /** Keeps every guide one hop from any page a crawler lands on. */
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
  private readonly viewportScroller = inject(ViewportScroller);

  private readonly scrollPositions = new Map<string, number>();
  private restoringHistoryPosition = false;

  ngOnInit(): void {
    this.http.get(`${environment.apiUrl}/health`).subscribe();

    this.router.events
      .pipe(
        filter((event): event is NavigationStart => event instanceof NavigationStart),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.scrollPositions.set(this.router.url, this.viewportScroller.getScrollPosition()[1]);
        this.restoringHistoryPosition = event.navigationTrigger === 'popstate';
      });

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.onNavigationEnd());
  }

  private onNavigationEnd(): void {
    this.restoreScroll();

    const snapshot = this.deepestActivatedRoute().snapshot;
    const title = (snapshot.data['title'] as string) ?? DEFAULT_TITLE;

    // Routes whose metadata depends on their params publish it themselves;
    // writing the generic fallback here would clobber the specific one.
    if (!snapshot.data['dynamicSeo']) {
      this.seo.update({
        title,
        description: (snapshot.data['description'] as string) ?? DEFAULT_DESCRIPTION,
        path: this.router.url,
      });
    }

    this.analytics.trackPageView(this.router.url, title);
  }

  private deepestActivatedRoute() {
    let route = this.activatedRoute;
    while (route.firstChild) route = route.firstChild;
    return route;
  }

  private restoreScroll(): void {
    const target = this.restoringHistoryPosition
      ? (this.scrollPositions.get(this.router.url) ?? 0)
      : 0;
    this.scrollTo(target);
  }

  /**
   * Retries while the page is still short: routed pages render their tables and
   * charts once their request resolves, so an immediate scroll to a deep offset
   * would be clamped to the current height and land in the wrong place.
   */
  private scrollTo(target: number, attempt = 0): void {
    this.viewportScroller.scrollToPosition([0, target]);

    if (typeof window === 'undefined' || target === 0 || attempt >= 5) return;
    if (Math.abs(this.viewportScroller.getScrollPosition()[1] - target) < 2) return;

    setTimeout(() => this.scrollTo(target, attempt + 1), 100);
  }
}
