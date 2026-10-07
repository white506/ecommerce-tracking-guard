import { makePerfectOrder, makePerfectTransaction } from '../builders.js';
import type { GoldenAuditFixture } from '../types.js';

const transactions = Array.from({ length: 10 }, (_, index) => {
  const transaction = makePerfectTransaction(index);

  if (index < 7) {
    return transaction;
  }

  return {
    ...transaction,
    transactionId: `unknown-${index}`,
  };
});

export const unresolvedMappingFixture: GoldenAuditFixture = {
  name: '05-unresolved-mapping',
  orders: Array.from({ length: 10 }, (_, index) => makePerfectOrder(index)),
  transactions,
  refunds: [],
  expectedMapping: { status: 'UNRESOLVED', confidence: 'LOW' },
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
