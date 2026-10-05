import { describe, expect, it } from 'vitest';

import {
  createMoney,
  moneyEquals,
  moneyFromDecimal,
  moneyToJSON,
} from '../../src/domain/money/money.js';

describe('Money', () => {
  it('stores amount in minor units as bigint', () => {
    const money = createMoney(12345n, 'USD');

    expect(money).toEqual({
      amountMinor: 12345n,
      currency: 'USD',
    });
  });

  it('normalizes currency to uppercase', () => {
    const money = createMoney(12345n, 'usd');

    expect(money.currency).toBe('USD');
  });

  it('converts a decimal string using the supplied currency exponent', () => {
    expect(moneyFromDecimal('123.45', 'USD', 2)).toEqual({
      amountMinor: 12345n,
      currency: 'USD',
    });

    expect(moneyFromDecimal('123', 'JPY', 0)).toEqual({
      amountMinor: 123n,
      currency: 'JPY',
    });

    expect(moneyFromDecimal('1.234', 'KWD', 3)).toEqual({
      amountMinor: 1234n,
      currency: 'KWD',
    });
  });

  it('handles negative decimal amounts without floating-point arithmetic', () => {
    expect(moneyFromDecimal('-12.34', 'USD', 2)).toEqual({
      amountMinor: -1234n,
      currency: 'USD',
    });
  });

  it('rejects a decimal value with more fractional digits than the exponent', () => {
    expect(() => moneyFromDecimal('12.345', 'USD', 2)).toThrow();
  });

  it('compares amount and currency exactly', () => {
    expect(
      moneyEquals(createMoney(12345n, 'USD'), createMoney(12345n, 'usd')),
    ).toBe(true);

    expect(
      moneyEquals(createMoney(12345n, 'USD'), createMoney(12346n, 'USD')),
    ).toBe(false);

    expect(
      moneyEquals(createMoney(12345n, 'USD'), createMoney(12345n, 'EUR')),
    ).toBe(false);
  });

  it('serializes bigint amount as a string', () => {
    expect(moneyToJSON(createMoney(12345n, 'USD'))).toEqual({
      amountMinor: '12345',
      currency: 'USD',
    });
  });
  it('pads fractional digits to the supplied exponent', () => {
    expect(moneyFromDecimal('12.3', 'USD', 2)).toEqual({
      amountMinor: 1230n,
      currency: 'USD',
    });

    expect(moneyFromDecimal('12', 'USD', 2)).toEqual({
      amountMinor: 1200n,
      currency: 'USD',
    });
  });

  it('handles zero and an explicit positive sign', () => {
    expect(moneyFromDecimal('0.00', 'USD', 2).amountMinor).toBe(0n);
    expect(moneyFromDecimal('+12.34', 'USD', 2).amountMinor).toBe(1234n);
  });

  it('preserves values larger than Number.MAX_SAFE_INTEGER', () => {
    expect(moneyFromDecimal('9007199254740993.01', 'USD', 2).amountMinor).toBe(
      900719925474099301n,
    );
  });

  it('rejects invalid currency codes', () => {
    expect(() => createMoney(100n, 'US')).toThrow();
    expect(() => createMoney(100n, 'USDD')).toThrow();
    expect(() => createMoney(100n, '')).toThrow();
  });

  it('rejects invalid currency exponents', () => {
    expect(() => moneyFromDecimal('12.34', 'USD', -1)).toThrow();
    expect(() => moneyFromDecimal('12.34', 'USD', 1.5)).toThrow();
  });

  it('rejects malformed decimal amounts', () => {
    expect(() => moneyFromDecimal('', 'USD', 2)).toThrow();
    expect(() => moneyFromDecimal('12.3.4', 'USD', 2)).toThrow();
    expect(() => moneyFromDecimal('NaN', 'USD', 2)).toThrow();
  });
});
