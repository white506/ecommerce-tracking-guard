import type { AnalyticsTransaction } from '../../src/domain/analytics/models.js';
import type { CanonicalOrder } from '../../src/domain/commerce/models.js';
import { createMoney } from '../../src/domain/money/money.js';

export function makeOrder(
  id: string,
  legacyResourceId: string,
): CanonicalOrder {
  return {
    id,
    identifiers: {
      legacyResourceId,
      name: `#${id}`,
      orderNumber: id,
      confirmationNumber: null,
    },
    createdAt: '2026-10-01T00:00:00.000Z',
    cancelledAt: null,
    currency: 'USD',
    itemSubtotal: createMoney(1000n, 'USD'),
    discounts: createMoney(0n, 'USD'),
    shipping: createMoney(0n, 'USD'),
    tax: createMoney(0n, 'USD'),
    originalTotal: createMoney(1000n, 'USD'),
    currentTotal: createMoney(1000n, 'USD'),
    items: [],
    refunds: [],
  };
}

export function makeTransaction(transactionId: string): AnalyticsTransaction {
  return {
    transactionId,
    occurredAt: '2026-10-01T00:00:00.000Z',
    value: createMoney(1000n, 'USD'),
    currency: 'USD',
    items: [],
  };
}
