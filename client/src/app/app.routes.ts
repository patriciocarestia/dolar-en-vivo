import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { RATE_TYPES } from './core/data/rate-types.data';

const rateDetailRoutes: Routes = RATE_TYPES.map((type) => ({
  path: type.slug,
  loadComponent: () =>
    import('./features/rate-detail/rate-detail.component').then((m) => m.RateDetailComponent),
  data: { dynamicSeo: true, title: type.metaTitle, slug: type.slug },
}));

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    data: {
      title: 'Dólar Blue, Oficial y Cripto Hoy en Argentina | Dólar en Vivo',
      description:
        'Dólar blue, oficial, MEP, CCL y cripto hoy en Argentina, actualizado en vivo. Conversor, histórico y análisis con IA.',
    },
  },
  {
    path: 'dashboard',
    redirectTo: '',
    pathMatch: 'full',
  },

  ...rateDetailRoutes,

  {
    path: 'brecha-cambiaria',
    loadComponent: () =>
      import('./features/brecha/brecha.component').then((m) => m.BrechaComponent),
    data: {
      dynamicSeo: true,
      title: 'Brecha Cambiaria Hoy: Dólar Blue vs Oficial | Dólar en Vivo',
    },
  },
  {
    path: 'calculadora/plazo-fijo-vs-dolar',
    loadComponent: () =>
      import('./features/calculadoras/plazo-fijo.component').then(
        (m) => m.PlazoFijoCalculatorComponent,
      ),
    data: {
      dynamicSeo: true,
      title: 'Plazo Fijo vs Dólar: Calculadora Comparativa | Dólar en Vivo',
    },
  },
  {
    path: 'convertir',
    loadComponent: () =>
      import('./features/convert/convert-hub.component').then((m) => m.ConvertHubComponent),
    data: { dynamicSeo: true, title: 'Conversor de Dólares a Pesos Argentinos | Dólar en Vivo' },
  },
  {
    path: 'convertir/:slug',
    loadComponent: () =>
      import('./features/convert/convert.component').then((m) => m.ConvertComponent),
    data: { dynamicSeo: true, title: 'Conversor | Dólar en Vivo' },
  },
  {
    path: 'historico/:slug',
    loadComponent: () =>
      import('./features/historico/historico.component').then((m) => m.HistoricoComponent),
    data: { dynamicSeo: true, title: 'Histórico del dólar | Dólar en Vivo' },
  },

  {
    path: 'portfolio',
    loadComponent: () =>
      import('./features/portfolio/portfolio.component').then((m) => m.PortfolioComponent),
    canActivate: [authGuard],
    data: {
      title: 'Mi Portfolio — Dólar en Vivo',
      description:
        'Seguí el valor de tu portfolio de dólares y criptomonedas ajustado por inflación.',
    },
  },
  {
    path: 'analysis',
    loadComponent: () =>
      import('./features/analysis/analysis.component').then((m) => m.AnalysisComponent),
    canActivate: [authGuard],
    data: {
      title: 'Análisis con IA — Dólar en Vivo',
      description: 'Análisis de tu portfolio y del contexto cambiario argentino generado con IA.',
    },
  },
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    data: {
      title: 'Ingresar — Dólar en Vivo',
      description:
        'Ingresá a tu cuenta de Dólar en Vivo para seguir tu portfolio y acceder al análisis con IA.',
    },
  },
  {
    path: 'auth/register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
    data: {
      title: 'Crear cuenta — Dólar en Vivo',
      description:
        'Creá tu cuenta gratis en Dólar en Vivo y empezá a seguir tu portfolio de dólares y cripto.',
    },
  },
  {
    path: '**',
    redirectTo: '',
  },
];
