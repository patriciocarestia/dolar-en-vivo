import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PlazoFijoCalculatorComponent } from './plazo-fijo.component';
import { RatesService } from '../../core/services/rates.service';
import { SeoService } from '../../core/services/seo.service';
import { ExchangeRate } from '../../store/rates/rates.model';

/** Blue series where the rate moved from `from` to `to` over `days`. */
function blueSeries(from: number, to: number, days: number): ExchangeRate[] {
  const today = new Date('2026-08-08T12:00:00Z').getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  return Array.from({ length: days + 1 }, (_, i) => {
    const progress = i / days;
    return {
      id: i,
      type: 'blue',
      buy: 0,
      sell: from + (to - from) * progress,
      changePercent: 0,
      recordedAt: new Date(today - (days - i) * dayMs).toISOString(),
    };
  });
}

describe('PlazoFijoCalculatorComponent', () => {
  let getHistory: jest.Mock;

  function createComponent(history: ExchangeRate[]) {
    getHistory = jest.fn().mockReturnValue(of(history));

    TestBed.configureTestingModule({
      imports: [PlazoFijoCalculatorComponent],
      providers: [
        provideRouter([]),
        { provide: RatesService, useValue: { getHistory } },
        {
          provide: SeoService,
          useValue: { update: jest.fn(), setJsonLd: jest.fn(), removeJsonLd: jest.fn() },
        },
      ],
    });

    const fixture = TestBed.createComponent(PlazoFijoCalculatorComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  describe('fixed-term deposit maths', () => {
    it('prorates the annual rate over the term, as banks liquidate it', () => {
      const component = createComponent(blueSeries(1000, 1000, 120));
      component.setAmount('1000000');
      component.setTna('36.5');
      component.setTerm(30);

      // 1,000,000 × 36.5% × 30/365 = 30,000
      expect(component.plazoFijoInterest()).toBeCloseTo(30_000, 0);
      expect(component.plazoFijoFinal()).toBeCloseTo(1_030_000, 0);
    });

    it('scales the interest with the term', () => {
      const component = createComponent(blueSeries(1000, 1000, 120));
      component.setAmount('1000000');
      component.setTna('36.5');

      component.setTerm(30);
      const thirtyDays = component.plazoFijoInterest();
      component.setTerm(90);

      expect(component.plazoFijoInterest()).toBeCloseTo(thirtyDays * 3, 0);
    });

    it('yields no interest at a zero rate', () => {
      const component = createComponent(blueSeries(1000, 1000, 120));
      component.setTna('0');
      expect(component.plazoFijoInterest()).toBe(0);
    });
  });

  describe('comparison against the dollar', () => {
    it('measures the dollar over the same window as the term', () => {
      // Linear 1000 → 1100 over 120 days: the last 30 days run 1075 → 1100,
      // so the window shows 25/1075 ≈ 2.33%, not the full 10% of the series.
      const component = createComponent(blueSeries(1000, 1100, 120));
      component.setTerm(30);

      expect(component.dollarChangePercent()).toBeCloseTo(2.33, 1);
    });

    it('declares the deposit the winner when the rate beats the dollar', () => {
      const component = createComponent(blueSeries(1000, 1010, 120));
      component.setAmount('1000000');
      component.setTna('60');
      component.setTerm(30);

      expect(component.winner()).toBe('plazo-fijo');
      expect(component.plazoFijoFinal()).toBeGreaterThan(component.dollarFinal()!);
    });

    it('declares the dollar the winner when it outruns the rate', () => {
      const component = createComponent(blueSeries(1000, 2000, 120));
      component.setAmount('1000000');
      component.setTna('10');
      component.setTerm(90);

      expect(component.winner()).toBe('dolar');
      expect(component.difference()).toBeGreaterThan(0);
    });

    it('annualises the dollar move so it is comparable to the TNA', () => {
      const component = createComponent(blueSeries(1000, 1100, 120));
      component.setTerm(30);

      const monthly = component.dollarChangePercent()!;
      expect(component.dollarAnnualised()).toBeCloseTo(monthly * (365 / 30), 1);
    });

    it('reports no comparison when the history is too short to span the term', () => {
      const component = createComponent([]);
      expect(component.dollarFinal()).toBeNull();
      expect(component.winner()).toBeNull();
    });
  });

  describe('input handling', () => {
    it('ignores a negative amount rather than inverting the result', () => {
      const component = createComponent(blueSeries(1000, 1000, 120));
      component.setAmount('-500');
      expect(component.plazoFijoFinal()).toBe(0);
    });

    it('ignores non-numeric input', () => {
      const component = createComponent(blueSeries(1000, 1000, 120));
      component.setTna('abc');
      expect(component.plazoFijoInterest()).toBe(0);
    });
  });

  it('requests enough history to cover the longest term offered', () => {
    createComponent(blueSeries(1000, 1000, 120));
    const [, days] = getHistory.mock.calls[0];
    expect(days).toBeGreaterThanOrEqual(90);
  });
});
