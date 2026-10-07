import { makePerfectOrder, makePerfectTransaction } from '../builders.js';
import type { GoldenAuditFixture } from '../types.js';

export const perfectFixture: GoldenAuditFixture = {
  name: '01-perfect',
  orders: Array.from({ length: 5 }, (_, index) => makePerfectOrder(index)),
  transactions: Array.from({ length: 5 }, (_, index) =>
    makePerfectTransaction(index),
  ),
  refunds: [],
  expectedMapping: { status: 'RESOLVED', confidence: 'HIGH' },
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
    REFUND_COVERAGE: 'NOT_APPLICABLE',
  },
};
