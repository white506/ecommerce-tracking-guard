export type Money = Readonly<{
  amountMinor: bigint;
  currency: string;
}>;

export type MoneyJSON = Readonly<{
  amountMinor: string;
  currency: string;
}>;

function normalizeCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error(`Invalid currency code: ${currency}`);
  }

  return normalized;
}

export function createMoney(amountMinor: bigint, currency: string): Money {
  return {
    amountMinor,
    currency: normalizeCurrency(currency),
  };
}

export function moneyFromDecimal(
  amount: string,
  currency: string,
  exponent: number,
): Money {
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new Error(`Invalid currency exponent: ${exponent}`);
  }

  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(amount);

  if (match === null) {
    throw new Error(`Invalid decimal amount: ${amount}`);
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const whole = match[2];
  const fraction = match[3] ?? '';

  if (whole === undefined) {
    throw new Error(`Invalid decimal amount: ${amount}`);
  }

  if (fraction.length > exponent) {
    throw new Error(
      `Decimal amount has more fractional digits than exponent ${exponent}`,
    );
  }

  const paddedFraction = fraction.padEnd(exponent, '0');
  const scale = 10n ** BigInt(exponent);

  const amountMinor =
    sign *
    (BigInt(whole) * scale +
      (paddedFraction.length === 0 ? 0n : BigInt(paddedFraction)));

  return createMoney(amountMinor, currency);
}

export function moneyEquals(left: Money, right: Money): boolean {
  return (
    left.amountMinor === right.amountMinor && left.currency === right.currency
  );
}

export function moneyToJSON(money: Money): MoneyJSON {
  return {
    amountMinor: money.amountMinor.toString(),
    currency: money.currency,
  };
}
