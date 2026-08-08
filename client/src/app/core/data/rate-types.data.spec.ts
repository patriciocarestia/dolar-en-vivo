import { RATE_TYPES, rateTypeBySlug } from './rate-types.data';

describe('rate types data', () => {
  it('has a unique slug per rate', () => {
    const slugs = RATE_TYPES.map((type) => type.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('maps every rate to a distinct API type', () => {
    const apiTypes = RATE_TYPES.map((type) => type.apiType);
    expect(new Set(apiTypes).size).toBe(apiTypes.length);
  });

  it('writes distinct meta titles so pages do not compete with each other', () => {
    const titles = RATE_TYPES.map((type) => type.metaTitle);
    expect(new Set(titles).size).toBe(titles.length);
  });

  describe.each(RATE_TYPES.map((type) => [type.slug, type] as const))('%s', (_slug, type) => {
    it('only links to rates that exist, and never to itself', () => {
      expect(type.related).not.toContain(type.slug);
      for (const slug of type.related) {
        expect(rateTypeBySlug(slug)).toBeDefined();
      }
    });

    it('carries the content the page needs to stand on its own', () => {
      expect(type.intro.length).toBeGreaterThan(0);
      expect(type.faqs.length).toBeGreaterThan(0);
      expect(type.legal.length).toBeGreaterThan(0);
      expect(type.audience.length).toBeGreaterThan(0);
    });

    it('keeps the meta description within what search results display', () => {
      expect(type.metaDescription.length).toBeLessThanOrEqual(165);
    });

    it('answers every FAQ it asks', () => {
      for (const faq of type.faqs) {
        expect(faq.question.endsWith('?')).toBe(true);
        expect(faq.answer.length).toBeGreaterThan(0);
      }
    });
  });

  describe('rateTypeBySlug', () => {
    it('resolves a known slug', () => {
      expect(rateTypeBySlug('dolar-mep')?.apiType).toBe('mep');
    });

    it('returns undefined for an unknown slug', () => {
      expect(rateTypeBySlug('dolar-inexistente')).toBeUndefined();
    });
  });
});
