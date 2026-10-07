import { Decimal } from 'decimal.js';

// Precision configured for financial transactions
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function toDecimal(value: number | string): Decimal {
  return new Decimal(value);
}

export function roundMoney(value: number | string): number {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function multiplyMoney(a: number | string, b: number | string): number {
  return new Decimal(a).times(new Decimal(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function addMoney(...values: (number | string)[]): number {
  let total = new Decimal(0);
  for (const v of values) {
    total = total.plus(new Decimal(v));
  }
  return total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function subtractMoney(a: number | string, b: number | string): number {
  return new Decimal(a).minus(new Decimal(b)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function formatMoney(value: number | string): string {
  return new Decimal(value).toFixed(2);
}
