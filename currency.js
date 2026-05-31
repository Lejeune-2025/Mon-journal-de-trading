/**
 * Devise d'affichage du journal (montants stockés en nombres, sans conversion).
 */
(function (global) {
  'use strict';

  const CURRENCY = {
    code: 'USD',
    symbol: '$',
    locale: 'en-US',
    decimals: 2
  };

  function parseAmount(n) {
    if (n === null || n === undefined || n === '') return null;
    const num = parseFloat(n);
    return Number.isFinite(num) ? num : null;
  }

  /** Montant signé pour P/L : +$12.34 / -$5.00 */
  function formatMoney(n) {
    const num = parseAmount(n);
    if (num === null) return '—';
    const sign = num >= 0 ? '+' : '-';
    return `${sign}${CURRENCY.symbol}${Math.abs(num).toFixed(CURRENCY.decimals)}`;
  }

  /** Montant sans signe explicite : $12.34 */
  function formatMoneyUnsigned(n) {
    const num = parseAmount(n);
    if (num === null) return '—';
    const sign = num < 0 ? '-' : '';
    return `${sign}${CURRENCY.symbol}${Math.abs(num).toFixed(CURRENCY.decimals)}`;
  }

  /** Axe graphique / valeurs compactes */
  function formatMoneyAxis(n, decimals = 0) {
    const num = parseAmount(n);
    if (num === null) return '—';
    const sign = num < 0 ? '-' : '';
    return `${sign}${CURRENCY.symbol}${Math.abs(num).toFixed(decimals)}`;
  }

  /** Nombre brut + symbole (ex. champ risque dans un tableau) */
  function withCurrency(amount) {
    if (amount === null || amount === undefined || amount === '') return '—';
    return `${amount} ${CURRENCY.symbol}`;
  }

  global.TradingJournalCurrency = {
    CURRENCY,
    formatMoney,
    formatMoneyUnsigned,
    formatMoneyAxis,
    withCurrency
  };
})(typeof window !== 'undefined' ? window : globalThis);
