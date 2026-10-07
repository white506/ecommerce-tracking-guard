import { createMoney } from '../../../../src/domain/money/money.js';
import { makePerfectOrder, makePerfectTransaction } from '../builders.js';
import type { GoldenAuditFixture } from '../types.js';

const transactions = Array.from({ length: 5 }, (_, index) =>
  makePerfectTransaction(index),
);

const firstTransaction = transactions[0]!;

transactions[0] = {
  ...firstTransaction,
  value: createMoney(900n, 'USD'),
};

export const revenueMismatchFixture: GoldenAuditFixture = {
  name: '03-revenue-mismatch',
  orders: Array.from({ length: 5 }, (_, index) => makePerfectOrder(index)),
  transactions,
  refunds: [],
  expectedMapping: { status: 'RESOLVED', confidence: 'HIGH' },
  expectedStatuses: {
    TRANSACTION_MAPPING: 'PASS',
    PURCHASE_COVERAGE: 'PASS',
    MISSING_PURCHASES: 'PASS',
    ORPHAN_GA4_TRANSACTIONS: 'PASS',
    TRANSACTION_VALUE_INTEGRITY: 'FAIL',
    CURRENCY_INTEGRITY: 'PASS',
    TRANSACTION_ID_INTEGRITY: 'PASS',
    ITEM_PRESENCE: 'PASS',
    ITEM_IDENTITY_INTEGRITY: 'PASS',
    REFUND_COVERAGE: 'NOT_APPLICABLE',
  },
};
