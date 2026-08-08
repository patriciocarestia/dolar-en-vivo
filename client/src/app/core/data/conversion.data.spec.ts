import {
  CONVERSION_ROUTES,
  conversionBySlug,
  conversionMetaTitle,
  conversionTitle,
  relatedConversions,
} from './conversion.data';

describe('conversion data', () => {
  it('exposes a unique slug for every route', () => {
    const slugs = CONVERSION_ROUTES.map((route) => route.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('builds slugs that match the routed URL shape', () => {
    for (const route of CONVERSION_ROUTES) {
      const expected =
        route.direction === 'usd-to-ars'
          ? `${route.amount}-dolares-a-pesos`
          : `${route.amount}-pesos-a-dolares`;
      expect(route.slug).toBe(expected);
    }
  });

  describe('conversionBySlug', () => {
    it('resolves a known slug to its amount and direction', () => {
      const route = conversionBySlug('100-dolares-a-pesos');
      expect(route).toEqual(expect.objectContaining({ amount: 100, direction: 'usd-to-ars' }));
    });

    it('returns undefined for an amount outside the curated list', () => {
      expect(conversionBySlug('37-dolares-a-pesos')).toBeUndefined();
    });
  });

  describe('relatedConversions', () => {
    it('never links a page to itself', () => {
      const route = conversionBySlug('100-dolares-a-pesos')!;
      const related = relatedConversions(route);
      expect(related.some((r) => r.slug === route.slug)).toBe(false);
    });

    it('only suggests amounts going the same way', () => {
      const route = conversionBySlug('1000-pesos-a-dolares')!;
      const related = relatedConversions(route);
      expect(related.every((r) => r.direction === 'ars-to-usd')).toBe(true);
    });

    it('orders suggestions by closeness in magnitude', () => {
      const route = conversionBySlug('100-dolares-a-pesos')!;
      const [nearest] = relatedConversions(route);
      // 50 and 200 are both one step away; either is acceptable, 10000 is not.
      expect([50, 200]).toContain(nearest.amount);
    });

    it('respects the requested limit', () => {
      const route = conversionBySlug('100-dolares-a-pesos')!;
      expect(relatedConversions(route, 3).length).toBe(3);
    });
  });

  describe('copy generation', () => {
    it('groups thousands in the visible heading', () => {
      const route = conversionBySlug('10000-dolares-a-pesos')!;
      expect(conversionTitle(route)).toContain('10.000');
    });

    it('phrases each direction from the reader’s point of view', () => {
      expect(conversionTitle(conversionBySlug('100-dolares-a-pesos')!)).toContain(
        'dólares en pesos',
      );
      expect(conversionTitle(conversionBySlug('1000-pesos-a-dolares')!)).toContain(
        'pesos en dólares',
      );
    });

    it('keeps the brand suffix on meta titles so tabs stay identifiable', () => {
      for (const route of CONVERSION_ROUTES) {
        expect(conversionMetaTitle(route)).toContain('Dólar en Vivo');
      }
    });
  });
});
