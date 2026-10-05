import type { AuditCheck } from '../check.js';

export const transactionMappingCheck: AuditCheck = {
  id: 'TRANSACTION_MAPPING',

  run: (context) => {
    const { orders, transactions, mapping } = context;

    const status =
      mapping.status === 'RESOLVED'
        ? 'PASS'
        : mapping.status === 'INSUFFICIENT_DATA'
          ? 'INSUFFICIENT_DATA'
          : 'WARNING';

    const title =
      mapping.status === 'RESOLVED'
        ? 'Transaction mapping resolved'
        : mapping.status === 'AMBIGUOUS'
          ? 'Transaction mapping is ambiguous'
          : mapping.status === 'UNRESOLVED'
            ? 'Transaction mapping unresolved'
            : 'Insufficient data for transaction mapping';

    const summary =
      mapping.status === 'RESOLVED'
        ? `${mapping.matches.length} ecommerce transactions were deterministically mapped to source orders.`
        : mapping.status === 'AMBIGUOUS'
          ? 'Multiple deterministic transaction mapping interpretations remain possible.'
          : mapping.status === 'UNRESOLVED'
            ? 'No deterministic transaction mapping strategy met the required confidence.'
            : 'There is not enough data to establish transaction mapping reliably.';

    return {
      checkId: 'TRANSACTION_MAPPING',
      status,
      severity: mapping.status === 'RESOLVED' ? 'INFO' : 'WARNING',
      confidence: mapping.confidence,
      title,
      summary,
      metrics: {
        orderCount: orders.length,
        transactionCount: transactions.length,
        matchedCount: mapping.matches.length,
      },
      evidence:
        mapping.status === 'RESOLVED'
          ? []
          : [
              {
                type: 'TRANSACTION_MAPPING_RESULT',
                description: 'Deterministic transaction resolver result.',
                data: {
                  mappingStatus: mapping.status,
                  mappingConfidence: mapping.confidence,
                  orderCount: orders.length,
                  transactionCount: transactions.length,
                  matchedCount: mapping.matches.length,
                  candidateCount: mapping.candidates.length,
                },
              },
            ],
      possibleCauses: [],
      recommendations: [],
      limitations:
        mapping.status === 'RESOLVED'
          ? []
          : [
              'Downstream transaction-level checks cannot reliably attribute GA4 transactions to source orders.',
            ],
    };
  },
};
