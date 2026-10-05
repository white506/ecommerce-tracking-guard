import type { Money } from '../money/money.js';

export type AnalyticsItem = Readonly<{
  itemId: string | null;
  itemName: string | null;
  quantity: number | null;
  price: Money | null;
}>;

export type AnalyticsTransaction = Readonly<{
  transactionId: string;
  occurredAt: string;
  value: Money | null;
  currency: string | null;
  items: readonly AnalyticsItem[];
}>;
