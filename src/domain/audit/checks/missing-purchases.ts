import type { AuditCheck } from '../check.js';

export const missingPurchasesCheck: AuditCheck = {
  id: 'MISSING_PURCHASES',

  run: (context) => {
    const { mapping } = context;

    if (mapping.status === 'RESOLVED') {
      const matchedOrderIds = new Set(
        mapping.matches.map((match) => match.order.id),
      );
      const missingOrders = context.orders.filter(
        (order) => !matchedOrderIds.has(order.id),
      );

      if (missingOrders.length > 0) {
        return {
          checkId: 'MISSING_PURCHASES',
          status: 'FAIL',
          severity: 'CRITICAL',
          confidence: mapping.confidence,
          title: 'Missing purchases detected',
          summary:
            'Some source orders have no deterministically mapped GA4 purchase transaction.',
          metrics: {
            orderCount: context.orders.length,
            matchedCount: mapping.matches.length,
            missingCount: missingOrders.length,
          },
          evidence: missingOrders.map((order) => ({
            type: 'MISSING_PURCHASE',
            description:
              'Source order has no deterministically mapped GA4 purchase transaction.',
            data: {
              orderId: order.id,
              legacyResourceId: order.identifiers.legacyResourceId,
            },
          })),
          possibleCauses: [],
          recommendations: [],
          limitations: [
            'Missing purchases are reported only after a deterministic transaction mapping strategy has been resolved.',
          ],
        };
      }

      return {
        checkId: 'MISSING_PURCHASES',
        status: 'PASS',
        severity: 'INFO',
        confidence: mapping.confidence,
        title: 'No missing purchases detected',
        summary:
          'Every source order has a deterministically mapped GA4 purchase transaction.',
        metrics: {
          orderCount: context.orders.length,
          matchedCount: mapping.matches.length,
          missingCount: 0,
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
      checkId: 'MISSING_PURCHASES',
      status,
      severity: 'WARNING',
      confidence: mapping.confidence,
      title: 'Missing purchases cannot be determined',
      summary:
        'Transaction mapping is unresolved, so missing purchases cannot be identified reliably.',
      metrics: {
        matchedCount: mapping.matches.length,
      },
      evidence: [
        {
          type: 'TRANSACTION_MAPPING_RESULT',
          description:
            'Transaction mapping required to identify missing purchases.',
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
        'Specific source orders cannot be classified as missing from GA4 until transaction mapping is resolved.',
      ],
    };
  },
};
