/**
 * Amounts that get their own conversion page. Kept finite on purpose:
 * arbitrary amounts would open an unbounded URL space of near-identical
 * pages, so anything outside these lists uses the interactive converter.
 */

export type ConversionDirection = 'usd-to-ars' | 'ars-to-usd';

export interface ConversionRoute {
  slug: string;
  direction: ConversionDirection;
  amount: number;
}

const USD_AMOUNTS = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
const ARS_AMOUNTS = [1000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];

export const CONVERSION_ROUTES: ConversionRoute[] = [
  ...USD_AMOUNTS.map((amount) => ({
    slug: `${amount}-dolares-a-pesos`,
    direction: 'usd-to-ars' as const,
    amount,
  })),
  ...ARS_AMOUNTS.map((amount) => ({
    slug: `${amount}-pesos-a-dolares`,
    direction: 'ars-to-usd' as const,
    amount,
  })),
];

export const CONVERSION_BY_SLUG = new Map(CONVERSION_ROUTES.map((c) => [c.slug, c]));

export function conversionBySlug(slug: string): ConversionRoute | undefined {
  return CONVERSION_BY_SLUG.get(slug);
}

/** Neighbouring amounts in the same direction, for internal linking. */
export function relatedConversions(route: ConversionRoute, limit = 6): ConversionRoute[] {
  const sameDirection = CONVERSION_ROUTES.filter(
    (c) => c.direction === route.direction && c.slug !== route.slug,
  );
  return sameDirection
    .map((c) => ({ route: c, distance: Math.abs(Math.log10(c.amount) - Math.log10(route.amount)) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((entry) => entry.route);
}

export function conversionTitle(route: ConversionRoute): string {
  const formatted = new Intl.NumberFormat('es-AR').format(route.amount);
  return route.direction === 'usd-to-ars'
    ? `¿Cuánto son ${formatted} dólares en pesos argentinos?`
    : `¿Cuánto son $${formatted} pesos en dólares?`;
}

export function conversionMetaTitle(route: ConversionRoute): string {
  const formatted = new Intl.NumberFormat('es-AR').format(route.amount);
  return route.direction === 'usd-to-ars'
    ? `${formatted} Dólares a Pesos Argentinos Hoy | Dólar en Vivo`
    : `${formatted} Pesos a Dólares Hoy | Dólar en Vivo`;
}

export function conversionMetaDescription(route: ConversionRoute): string {
  const formatted = new Intl.NumberFormat('es-AR').format(route.amount);
  return route.direction === 'usd-to-ars'
    ? `Cuánto son ${formatted} dólares en pesos argentinos hoy, según el dólar blue, oficial, MEP, CCL y cripto. Conversión actualizada en vivo.`
    : `Cuánto son $${formatted} pesos argentinos en dólares hoy, según el dólar blue, oficial, MEP, CCL y cripto. Conversión actualizada en vivo.`;
}
