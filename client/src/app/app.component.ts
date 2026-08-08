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
  private readonly viewportScroller = inject(ViewportScroller);

  /**
   * Scroll offset per URL, so back/forward returns where the user left off.
   * Router-level restoration doesn't hold up here: these routes are lazy and
   * fetch their data after navigation settles, so any scroll applied at
   * NavigationEnd lands on a page that hasn't reached full height yet.
   */
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
      .subscribe(() => {
        const target = this.restoringHistoryPosition
          ? (this.scrollPositions.get(this.router.url) ?? 0)
          : 0;
        this.scrollToWhenTallEnough(target);
      });

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

  /**
   * Applies a scroll offset, retrying briefly while the page is still short.
   * Rate and history pages render their tables and charts once their request
   * resolves, so an immediate scroll to a deep offset would be clamped to the
   * current (smaller) height and silently land in the wrong place.
   */
  private scrollToWhenTallEnough(target: number, attempt = 0): void {
    this.viewportScroller.scrollToPosition([0, target]);

    if (typeof window === 'undefined' || target === 0 || attempt >= 5) return;
    if (Math.abs(this.viewportScroller.getScrollPosition()[1] - target) < 2) return;

    setTimeout(() => this.scrollToWhenTallEnough(target, attempt + 1), 100);
  }
}
