import { createSelector } from '@ngrx/store';
import { ratesFeature } from './rates.reducer';

export const selectRatesState = ratesFeature.selectRatesState;

export const selectExchangeRates = createSelector(selectRatesState, (state) => state.exchangeRates);

export const selectCryptoRates = createSelector(selectRatesState, (state) => state.cryptoRates);

export const selectRatesHistory = createSelector(selectRatesState, (state) => state.history);

export const selectRatesLoading = createSelector(selectRatesState, (state) => state.loading);

export const selectRatesError = createSelector(selectRatesState, (state) => state.error);

export const selectLastFetched = createSelector(selectRatesState, (state) => state.lastFetched);

// When the data itself was recorded, as opposed to when the browser last asked for it.
// A stalled backend still answers instantly, so only this can tell the page is stale.
export const selectRatesRecordedAt = createSelector(selectRatesState, (state) => {
  const times = [...state.exchangeRates, ...state.cryptoRates]
    .map((rate) => new Date(rate.recordedAt).getTime())
    .filter((time) => !Number.isNaN(time));

  return times.length ? new Date(Math.max(...times)).toISOString() : null;
});
