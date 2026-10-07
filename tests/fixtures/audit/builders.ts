import type { AnalyticsTransaction } from '../../../src/domain/analytics/models.js';
import type { CanonicalOrder } from '../../../src/domain/commerce/models.js';
import { createMoney } from '../../../src/domain/money/money.js';

export function makePerfectOrder(index: number): CanonicalOrder {
  const id = `order-${index}`;
  const legacyResourceId = `legacy-${index}`;
  const itemId = `item-${index}`;

  return {
    id,
    identifiers: {
      legacyResourceId,
      name: `#${1000 + index}`,
      orderNumber: `${1000 + index}`,
      confirmationNumber: `CONF-${index}`,
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
    items: [
      {
        id: itemId,
        productId: `product-${index}`,
        variantId: `variant-${index}`,
        sku: `SKU-${index}`,
        name: `Product ${index}`,
        quantity: 1,
        unitPrice: createMoney(1000n, 'USD'),
        total: createMoney(1000n, 'USD'),
      },
    ],
    refunds: [],
  };
}

export function makePerfectTransaction(index: number): AnalyticsTransaction {
  return {
    transactionId: `legacy-${index}`,
    occurredAt: '2026-10-01T00:01:00.000Z',
    value: createMoney(1000n, 'USD'),
    currency: 'USD',
    items: [
      {
        itemId: `item-${index}`,
        itemName: `Product ${index}`,
        quantity: 1,
        price: createMoney(1000n, 'USD'),
      },
    ],
  };
}
