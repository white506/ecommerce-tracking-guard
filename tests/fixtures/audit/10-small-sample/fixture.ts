import { makePerfectOrder, makePerfectTransaction } from '../builders.js';
import type { GoldenAuditFixture } from '../types.js';

export const smallSampleFixture: GoldenAuditFixture = {
  name: '10-small-sample',
  orders: Array.from({ length: 4 }, (_, index) => makePerfectOrder(index)),
  transactions: Array.from({ length: 4 }, (_, index) =>
    makePerfectTransaction(index),
  ),
  refunds: [],
  expectedMapping: {
    status: 'INSUFFICIENT_DATA',
    confidence: 'LOW',
  },
  expectedStatuses: {
    TRANSACTION_MAPPING: 'INSUFFICIENT_DATA',
    PURCHASE_COVERAGE: 'INSUFFICIENT_DATA',
    MISSING_PURCHASES: 'INSUFFICIENT_DATA',
    ORPHAN_GA4_TRANSACTIONS: 'INSUFFICIENT_DATA',
    TRANSACTION_VALUE_INTEGRITY: 'INSUFFICIENT_DATA',
    CURRENCY_INTEGRITY: 'INSUFFICIENT_DATA',
    TRANSACTION_ID_INTEGRITY: 'INSUFFICIENT_DATA',
    ITEM_PRESENCE: 'INSUFFICIENT_DATA',
    ITEM_IDENTITY_INTEGRITY: 'INSUFFICIENT_DATA',
    REFUND_COVERAGE: 'NOT_APPLICABLE',
  },
};
