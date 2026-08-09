import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideMarkdown } from 'ngx-markdown';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { authFeature } from './store/auth/auth.reducer';
import { ratesFeature } from './store/rates/rates.reducer';
import { portfolioFeature } from './store/portfolio/portfolio.reducer';
import { analysisFeature } from './store/analysis/analysis.reducer';
import { AuthEffects } from './store/auth/auth.effects';
import { RatesEffects } from './store/rates/rates.effects';
import { PortfolioEffects } from './store/portfolio/portfolio.effects';
import { AnalysisEffects } from './store/analysis/analysis.effects';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions,
} from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideStore({
      [authFeature.name]: authFeature.reducer,
      [ratesFeature.name]: ratesFeature.reducer,
      [portfolioFeature.name]: portfolioFeature.reducer,
      [analysisFeature.name]: analysisFeature.reducer,
    }),
    provideEffects([AuthEffects, RatesEffects, PortfolioEffects, AnalysisEffects]),
    ...(environment.production ? [] : [provideStoreDevtools({ maxAge: 25 })]),
    provideMarkdown(),
    provideClientHydration(withEventReplay(), withHttpTransferCacheOptions({})),
  ],
};
