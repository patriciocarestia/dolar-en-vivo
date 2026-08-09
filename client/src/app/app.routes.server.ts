import { RenderMode, ServerRoute } from '@angular/ssr';
import { RATE_TYPES } from './core/data/rate-types.data';
import { CONVERSION_ROUTES } from './core/data/conversion.data';

// Indexable pages are prerendered; authenticated ones stay client-rendered
// because their guard reads localStorage, absent at build time.
export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  ...RATE_TYPES.map(
    (type): ServerRoute => ({
      path: type.slug,
      renderMode: RenderMode.Prerender,
    }),
  ),
  {
    path: 'brecha-cambiaria',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'calculadora/plazo-fijo-vs-dolar',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'convertir',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'convertir/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => CONVERSION_ROUTES.map((route) => ({ slug: route.slug })),
  },
  {
    path: 'historico/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => RATE_TYPES.map((type) => ({ slug: type.slug })),
  },
  {
    path: 'auth/login',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'auth/register',
    renderMode: RenderMode.Prerender,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
