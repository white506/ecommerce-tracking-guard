import type { AuditCheck } from '../check.js';

export const purchaseCoverageCheck: AuditCheck = {
  id: 'PURCHASE_COVERAGE',

  run: (context) => {
    const { orders, transactions, mapping } = context;

    if (mapping.status === 'RESOLVED') {
      const coverage =
        orders.length === 0 ? 0 : mapping.matches.length / orders.length;

      if (coverage !== 1) {
        return {
          checkId: 'PURCHASE_COVERAGE',
          status: 'WARNING',
          severity: 'WARNING',
          confidence: mapping.confidence,
          title: 'Purchase coverage is incomplete',
          summary:
            'Not all source orders were mapped to GA4 purchase transactions.',
          metrics: {
            orderCount: orders.length,
            transactionCount: transactions.length,
            matchedCount: mapping.matches.length,
            coverage,
          },
          evidence: [
            {
              type: 'PURCHASE_COVERAGE',
              description:
                'Observed deterministic mapping coverage compared with complete source-order coverage.',
              data: {
                observedCoverage: coverage,
                expectedCoverage: 1,
                affectedCount: orders.length - mapping.matches.length,
              },
            },
          ],
          possibleCauses: [],
          recommendations: [],
          limitations: [
            'This check measures aggregate purchase coverage; specific missing source orders are evaluated separately.',
          ],
        };
      }

      return {
        checkId: 'PURCHASE_COVERAGE',
        status: 'PASS',
        severity: 'INFO',
        confidence: mapping.confidence,
        title: 'Purchase coverage is complete',
        summary: 'All source orders were mapped to GA4 purchase transactions.',
        metrics: {
          orderCount: orders.length,
          transactionCount: transactions.length,
          matchedCount: mapping.matches.length,
          coverage,
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
      checkId: 'PURCHASE_COVERAGE',
      status,
      severity: 'WARNING',
      confidence: mapping.confidence,
      title: 'Purchase coverage cannot be determined',
      summary:
        'Transaction mapping is unresolved, so purchase coverage cannot be measured reliably.',
      metrics: {
        orderCount: orders.length,
        transactionCount: transactions.length,
        matchedCount: mapping.matches.length,
      },
      evidence: [
        {
          type: 'TRANSACTION_MAPPING_RESULT',
          description: 'Transaction mapping required for purchase coverage.',
          data: {
            mappingStatus: mapping.status,
            mappingConfidence: mapping.confidence,
            matchedCount: mapping.matches.length,
          },
        },
      ],
      possibleCauses: [],
      recommendations: [],
      limitations: [
        'Purchase coverage cannot be attributed reliably until transaction mapping is resolved.',
      ],
    };
  },
};
