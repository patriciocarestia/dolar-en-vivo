import { RenderMode, ServerRoute } from '@angular/ssr';
import { RATE_TYPES } from './core/data/rate-types.data';
import { CONVERSION_ROUTES } from './core/data/conversion.data';

/**
 * Everything that exists to be found in search is prerendered: these pages are
 * built from content we ship, so a crawler gets real HTML on the first request
 * without waiting on the render queue. The authenticated sections stay
 * client-rendered — their auth guard reads localStorage, which doesn't exist
 * during prerendering, and they're excluded from indexing anyway.
 */
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
    // Portfolio and analysis are behind an auth guard that reads
    // localStorage, which doesn't exist during prerendering — render
    // them client-side only.
    path: '**',
    renderMode: RenderMode.Client,
  },
];
