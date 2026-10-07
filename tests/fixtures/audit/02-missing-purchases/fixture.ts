import { makePerfectOrder, makePerfectTransaction } from '../builders.js';
import type { GoldenAuditFixture } from '../types.js';

export const missingPurchasesFixture: GoldenAuditFixture = {
  name: '02-missing-purchases',
  orders: Array.from({ length: 10 }, (_, index) => makePerfectOrder(index)),
  transactions: Array.from({ length: 9 }, (_, index) =>
    makePerfectTransaction(index),
  ),
  refunds: [],
  expectedMapping: { status: 'RESOLVED', confidence: 'MEDIUM' },
  expectedStatuses: {
    TRANSACTION_MAPPING: 'PASS',
    PURCHASE_COVERAGE: 'WARNING',
    MISSING_PURCHASES: 'FAIL',
    ORPHAN_GA4_TRANSACTIONS: 'PASS',
    TRANSACTION_VALUE_INTEGRITY: 'PASS',
    CURRENCY_INTEGRITY: 'PASS',
    TRANSACTION_ID_INTEGRITY: 'PASS',
    ITEM_PRESENCE: 'PASS',
    ITEM_IDENTITY_INTEGRITY: 'PASS',
    REFUND_COVERAGE: 'NOT_APPLICABLE',
  },
};
