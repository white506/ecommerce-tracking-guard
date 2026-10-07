import { createMoney } from '../../../../src/domain/money/money.js';
import { makePerfectOrder, makePerfectTransaction } from '../builders.js';
import type { GoldenAuditFixture } from '../types.js';

const orders = Array.from({ length: 5 }, (_, index) => makePerfectOrder(index));

const firstOrder = orders[0]!;

orders[0] = {
  ...firstOrder,
  refunds: [
    {
      id: 'refund-0',
      createdAt: '2026-10-02T00:00:00.000Z',
      amount: createMoney(1000n, 'USD'),
      items: [
        {
          orderItemId: 'item-0',
          quantity: 1,
          amount: createMoney(1000n, 'USD'),
        },
      ],
    },
  ],
};

export const refundsFixture: GoldenAuditFixture = {
  name: '08-refunds',
  orders,
  transactions: Array.from({ length: 5 }, (_, index) =>
    makePerfectTransaction(index),
  ),
  refunds: [
    {
      transactionId: 'legacy-0',
      occurredAt: '2026-10-02T00:01:00.000Z',
      value: createMoney(1000n, 'USD'),
      currency: 'USD',
      items: [],
    },
  ],
  expectedMapping: {
    status: 'RESOLVED',
    confidence: 'HIGH',
  },
  expectedStatuses: {
    TRANSACTION_MAPPING: 'PASS',
    PURCHASE_COVERAGE: 'PASS',
    MISSING_PURCHASES: 'PASS',
    ORPHAN_GA4_TRANSACTIONS: 'PASS',
    TRANSACTION_VALUE_INTEGRITY: 'PASS',
    CURRENCY_INTEGRITY: 'PASS',
    TRANSACTION_ID_INTEGRITY: 'PASS',
    ITEM_PRESENCE: 'PASS',
    ITEM_IDENTITY_INTEGRITY: 'PASS',
    REFUND_COVERAGE: 'PASS',
  },
};
