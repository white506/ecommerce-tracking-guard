import { makePerfectOrder, makePerfectTransaction } from '../builders.js';
import type { GoldenAuditFixture } from '../types.js';

const legacyTransactions = Array.from({ length: 5 }, (_, index) =>
  makePerfectTransaction(index),
);

const orderNumberTransactions = Array.from({ length: 5 }, (_, index) => ({
  ...makePerfectTransaction(index),
  transactionId: `${1000 + index}`,
}));

export const ambiguousMappingFixture: GoldenAuditFixture = {
  name: '06-ambiguous-mapping',
  orders: Array.from({ length: 5 }, (_, index) => makePerfectOrder(index)),
  transactions: [...legacyTransactions, ...orderNumberTransactions],
  refunds: [],
  expectedMapping: { status: 'AMBIGUOUS', confidence: 'LOW' },
  expectedStatuses: {
    TRANSACTION_MAPPING: 'WARNING',
    PURCHASE_COVERAGE: 'UNKNOWN',
    MISSING_PURCHASES: 'UNKNOWN',
    ORPHAN_GA4_TRANSACTIONS: 'UNKNOWN',
    TRANSACTION_VALUE_INTEGRITY: 'UNKNOWN',
    CURRENCY_INTEGRITY: 'UNKNOWN',
    TRANSACTION_ID_INTEGRITY: 'UNKNOWN',
    ITEM_PRESENCE: 'UNKNOWN',
    ITEM_IDENTITY_INTEGRITY: 'UNKNOWN',
    REFUND_COVERAGE: 'NOT_APPLICABLE',
  },
};
