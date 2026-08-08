import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;
  let document: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SeoService, Title, Meta] });
    service = TestBed.inject(SeoService);
    document = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    document.querySelector('link[rel="canonical"]')?.remove();
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove());
  });

  const metaContent = (selector: string) =>
    document.querySelector(selector)?.getAttribute('content');

  describe('update', () => {
    it('sets the document title', () => {
      service.update({ title: 'Dólar MEP Hoy', description: 'Cotización del MEP' });
      expect(TestBed.inject(Title).getTitle()).toBe('Dólar MEP Hoy');
    });

    it('mirrors title and description into Open Graph and Twitter tags', () => {
      service.update({ title: 'Dólar CCL Hoy', description: 'Qué es el CCL' });

      expect(metaContent('meta[property="og:title"]')).toBe('Dólar CCL Hoy');
      expect(metaContent('meta[name="twitter:title"]')).toBe('Dólar CCL Hoy');
      expect(metaContent('meta[name="description"]')).toBe('Qué es el CCL');
      expect(metaContent('meta[property="og:description"]')).toBe('Qué es el CCL');
    });

    it('builds absolute URLs from the given path', () => {
      service.update({ title: 'T', description: 'D', path: '/dolar-blue' });
      expect(metaContent('meta[property="og:url"]')).toBe(
        'https://www.dolarenvivo.com.ar/dolar-blue',
      );
    });

    it('points the canonical link at the current page', () => {
      service.update({ title: 'T', description: 'D', path: '/brecha-cambiaria' });

      const canonical = document.querySelector('link[rel="canonical"]');
      expect(canonical?.getAttribute('href')).toBe(
        'https://www.dolarenvivo.com.ar/brecha-cambiaria',
      );
    });

    it('reuses the canonical element across navigations instead of stacking them', () => {
      service.update({ title: 'T', description: 'D', path: '/dolar-blue' });
      service.update({ title: 'T', description: 'D', path: '/dolar-mep' });

      const links = document.querySelectorAll('link[rel="canonical"]');
      expect(links.length).toBe(1);
      expect(links[0].getAttribute('href')).toBe('https://www.dolarenvivo.com.ar/dolar-mep');
    });
  });

  describe('structured data', () => {
    const jsonLd = (id: string) => document.getElementById(`jsonld-${id}`);

    it('writes the payload into a JSON-LD script tag', () => {
      service.setJsonLd('faq', { '@type': 'FAQPage' });

      const script = jsonLd('faq');
      expect(script?.getAttribute('type')).toBe('application/ld+json');
      expect(JSON.parse(script!.textContent!)).toEqual({ '@type': 'FAQPage' });
    });

    it('replaces the previous payload rather than appending a second block', () => {
      service.setJsonLd('faq', { '@type': 'FAQPage', mainEntity: [] });
      service.setJsonLd('faq', { '@type': 'FAQPage', mainEntity: [{ name: 'Q' }] });

      expect(document.querySelectorAll('#jsonld-faq').length).toBe(1);
      expect(JSON.parse(jsonLd('faq')!.textContent!).mainEntity.length).toBe(1);
    });

    it('removes the block when a page is torn down', () => {
      service.setJsonLd('faq', { '@type': 'FAQPage' });
      service.removeJsonLd('faq');
      expect(jsonLd('faq')).toBeNull();
    });

    it('tolerates removing a block that was never added', () => {
      expect(() => service.removeJsonLd('never-set')).not.toThrow();
    });
  });
});
