import { makePerfectOrder, makePerfectTransaction } from '../builders.js';
import type { GoldenAuditFixture } from '../types.js';

const transactions = Array.from({ length: 5 }, (_, index) =>
  makePerfectTransaction(index),
);

const firstTransaction = transactions[0]!;

transactions[0] = {
  ...firstTransaction,
  items: [],
};

export const missingItemsFixture: GoldenAuditFixture = {
  name: '07-missing-items',
  orders: Array.from({ length: 5 }, (_, index) => makePerfectOrder(index)),
  transactions,
  refunds: [],
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
    ITEM_PRESENCE: 'FAIL',
    ITEM_IDENTITY_INTEGRITY: 'UNKNOWN',
    REFUND_COVERAGE: 'NOT_APPLICABLE',
  },
};
