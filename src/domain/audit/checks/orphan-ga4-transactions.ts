import type { AuditCheck } from '../check.js';

export const orphanGa4TransactionsCheck: AuditCheck = {
  id: 'ORPHAN_GA4_TRANSACTIONS',

  run: (context) => {
    const { mapping } = context;

    if (mapping.status === 'RESOLVED') {
      const matchedTransactionIds = new Set(
        mapping.matches.map((match) => match.transaction.transactionId),
      );
      const orphanTransactions = context.transactions.filter(
        (transaction) => !matchedTransactionIds.has(transaction.transactionId),
      );

      if (orphanTransactions.length > 0) {
        return {
          checkId: 'ORPHAN_GA4_TRANSACTIONS',
          status: 'FAIL',
          severity: 'WARNING',
          confidence: mapping.confidence,
          title: 'Orphan GA4 transactions detected',
          summary:
            'Some GA4 purchase transactions have no deterministically mapped source order.',
          metrics: {
            transactionCount: context.transactions.length,
            matchedCount: mapping.matches.length,
            orphanCount: orphanTransactions.length,
            expectedOrphanCount: 0,
            affectedCount: orphanTransactions.length,
          },
          evidence: orphanTransactions.map((transaction) => ({
            type: 'ORPHAN_GA4_TRANSACTION',
            description:
              'GA4 purchase transaction has no deterministically mapped source order.',
            data: {
              transactionId: transaction.transactionId,
              observedOrphanTransaction: true,
              expectedOrphanTransaction: false,
              comparisonBasis: 'RESOLVED_TRANSACTION_MAPPING',
              affectedCount: 1,
            },
          })),
          possibleCauses: [],
          recommendations: [],
          limitations: [
            'Orphan transactions are reported only after a deterministic transaction mapping strategy has been resolved.',
          ],
        };
      }

      return {
        checkId: 'ORPHAN_GA4_TRANSACTIONS',
        status: 'PASS',
        severity: 'INFO',
        confidence: mapping.confidence,
        title: 'No orphan GA4 transactions detected',
        summary:
          'Every GA4 purchase transaction has a deterministically mapped source order.',
        metrics: {
          transactionCount: context.transactions.length,
          matchedCount: mapping.matches.length,
          orphanCount: 0,
        },
        evidence: [],
        possibleCauses: [],
        recommendations: [],
        limitations: [],
      };
    }

    const status =
      mapping.status === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT_DATA' : 'UNKNOWN';

    return {
      checkId: 'ORPHAN_GA4_TRANSACTIONS',
      status,
      severity: 'WARNING',
      confidence: mapping.confidence,
      title: 'Orphan GA4 transactions cannot be determined',
      summary:
        'Transaction mapping is not resolved, so orphan GA4 transactions cannot be identified reliably.',
      metrics: {
        transactionCount: context.transactions.length,
        matchedCount: mapping.matches.length,
        affectedCount: null,
      },
      evidence: [
        {
          type: 'TRANSACTION_MAPPING_RESULT',
          description:
            'Transaction mapping required to identify orphan GA4 transactions.',
          data: {
            mappingStatus: mapping.status,
            mappingConfidence: mapping.confidence,
            matchedCount: mapping.matches.length,
            observedOrphanCount: null,
            expectedOrphanCount: 0,
            comparisonBasis: 'RESOLVED_TRANSACTION_MAPPING',
            affectedCount: null,
          },
        },
      ],
      possibleCauses: [],
      recommendations: [],
      limitations: [
        'GA4 transactions cannot be classified as orphaned until transaction mapping is resolved.',
      ],
    };
  },
};
