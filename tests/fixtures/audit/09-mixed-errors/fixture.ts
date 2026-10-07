import { createMoney } from '../../../../src/domain/money/money.js';
import { makePerfectOrder, makePerfectTransaction } from '../builders.js';
import type { GoldenAuditFixture } from '../types.js';

const transactions = Array.from({ length: 9 }, (_, index) =>
  makePerfectTransaction(index),
);

transactions[0] = {
  ...transactions[0]!,
  value: createMoney(900n, 'USD'),
};

transactions[1] = {
  ...transactions[1]!,
  currency: 'EUR',
};

export const mixedErrorsFixture: GoldenAuditFixture = {
  name: '09-mixed-errors',
  orders: Array.from({ length: 10 }, (_, index) => makePerfectOrder(index)),
  transactions,
  refunds: [],
  expectedMapping: {
    status: 'RESOLVED',
    confidence: 'MEDIUM',
  },
  expectedStatuses: {
    TRANSACTION_MAPPING: 'PASS',
    PURCHASE_COVERAGE: 'WARNING',
    MISSING_PURCHASES: 'FAIL',
    ORPHAN_GA4_TRANSACTIONS: 'PASS',
    TRANSACTION_VALUE_INTEGRITY: 'FAIL',
    CURRENCY_INTEGRITY: 'FAIL',
    TRANSACTION_ID_INTEGRITY: 'PASS',
    ITEM_PRESENCE: 'PASS',
    ITEM_IDENTITY_INTEGRITY: 'PASS',
    REFUND_COVERAGE: 'NOT_APPLICABLE',
  },
};
