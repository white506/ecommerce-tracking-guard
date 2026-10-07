import type { AuditCheck } from '../check.js';

export const refundCoverageCheck: AuditCheck = {
  id: 'REFUND_COVERAGE',

  run: (context) => {
    const refundedOrders = context.orders.filter(
      (order) => order.refunds.length > 0,
    );

    if (refundedOrders.length === 0) {
      return {
        checkId: 'REFUND_COVERAGE',
        status: 'NOT_APPLICABLE',
        severity: 'INFO',
        confidence: context.mapping.confidence,
        title: 'Refund coverage is not applicable',
        summary: 'No source orders contain refunds.',
        metrics: {
          refundedOrderCount: 0,
          affectedCount: 0,
        },
        evidence: [],
        possibleCauses: [],
        recommendations: [],
        limitations: [],
      };
    }

    if (context.mapping.status !== 'RESOLVED') {
      const status =
        context.mapping.status === 'INSUFFICIENT_DATA'
          ? 'INSUFFICIENT_DATA'
          : 'UNKNOWN';

      return {
        checkId: 'REFUND_COVERAGE',
        status,
        severity: 'WARNING',
        confidence: context.mapping.confidence,
        title: 'Refund coverage cannot be determined',
        summary:
          'Purchase transaction mapping is not resolved, so refund coverage cannot be determined reliably.',
        metrics: {
          refundedOrderCount: refundedOrders.length,
          affectedCount: refundedOrders.length,
        },
        evidence: [
          {
            type: 'TRANSACTION_MAPPING_RESULT',
            description:
              'Resolved purchase transaction mapping is required to evaluate refund coverage.',
            data: {
              mappingStatus: context.mapping.status,
              mappingConfidence: context.mapping.confidence,
              expectedMappingStatus: 'RESOLVED',
              comparisonBasis: 'RESOLVED_TRANSACTION_MAPPING',
              affectedCount: refundedOrders.length,
            },
          },
        ],
        possibleCauses: [],
        recommendations: [],
        limitations: [
          'Refund coverage cannot be evaluated until purchase transaction mapping is resolved.',
        ],
      };
    }

    const refundedOrderIds = new Set(refundedOrders.map((order) => order.id));
    const matches = context.mapping.matches.filter((match) =>
      refundedOrderIds.has(match.order.id),
    );
    const matchedOrderIds = new Set(matches.map((match) => match.order.id));
    const unmatchedRefundedOrders = refundedOrders.filter(
      (order) => !matchedOrderIds.has(order.id),
    );
    const multipleRefundOrders = matches
      .map((match) => match.order)
      .filter((order) => order.refunds.length > 1);

    const missing = matches.filter(
      (match) =>
        !context.refunds.some(
          (refund) => refund.transactionId === match.transaction.transactionId,
        ),
    );

    if (missing.length > 0) {
      return {
        checkId: 'REFUND_COVERAGE',
        status: 'FAIL',
        severity: 'WARNING',
        confidence: context.mapping.confidence,
        title: 'Missing GA4 refunds detected',
        summary:
          'Some deterministically mapped refunded orders have no GA4 refund event for the mapped purchase transaction.',
        metrics: {
          refundedOrderCount: refundedOrders.length,
          assessedRefundedOrderCount: matches.length,
          missingRefundedOrderCount: missing.length,
          affectedCount: missing.length,
        },
        evidence: missing.map((match) => ({
          type: 'MISSING_REFUND',
          description:
            'Refunded source order has no GA4 refund event for its mapped purchase transaction.',
          data: {
            orderId: match.order.id,
            transactionId: match.transaction.transactionId,
            sourceRefundCount: match.order.refunds.length,
            observedAnalyticsRefundEventCount: 0,
            expectedAnalyticsRefundPresence: true,
            comparisonBasis: 'RESOLVED_PURCHASE_TRANSACTION_ID',
            affectedCount: 1,
          },
        })),
        possibleCauses: [],
        recommendations: [],
        limitations: [
          'This check evaluates refund presence by resolved purchase transaction ID; it does not compare refund amounts, currencies, items, or quantities.',
        ],
      };
    }

    if (unmatchedRefundedOrders.length > 0) {
      return {
        checkId: 'REFUND_COVERAGE',
        status: 'UNKNOWN',
        severity: 'WARNING',
        confidence: context.mapping.confidence,
        title: 'Refund coverage cannot be fully determined',
        summary:
          'Some refunded source orders have no resolved purchase transaction match.',
        metrics: {
          refundedOrderCount: refundedOrders.length,
          assessedRefundedOrderCount: matches.length,
          unassessedRefundedOrderCount: unmatchedRefundedOrders.length,
          affectedCount: unmatchedRefundedOrders.length,
        },
        evidence: unmatchedRefundedOrders.map((order) => ({
          type: 'UNMAPPED_REFUNDED_ORDER',
          description:
            'Refunded source order has no resolved purchase transaction match.',
          data: {
            orderId: order.id,
            sourceRefundCount: order.refunds.length,
            comparisonBasis: 'RESOLVED_PURCHASE_TRANSACTION_ID',
            affectedCount: 1,
          },
        })),
        possibleCauses: [],
        recommendations: [],
        limitations: [
          'Refund coverage cannot be evaluated for refunded orders without a resolved purchase transaction match.',
        ],
      };
    }

    if (multipleRefundOrders.length > 0) {
      return {
        checkId: 'REFUND_COVERAGE',
        status: 'UNKNOWN',
        severity: 'WARNING',
        confidence: context.mapping.confidence,
        title: 'Refund coverage cannot be fully determined',
        summary:
          'Some source orders contain multiple refunds that cannot be matched individually to GA4 refund events.',
        metrics: {
          refundedOrderCount: refundedOrders.length,
          assessedRefundedOrderCount: matches.length,
          multipleRefundOrderCount: multipleRefundOrders.length,
          affectedCount: multipleRefundOrders.length,
        },
        evidence: multipleRefundOrders.map((order) => ({
          type: 'MULTIPLE_SOURCE_REFUNDS',
          description:
            'Multiple source refunds cannot be proven individually covered using purchase transaction ID alone.',
          data: {
            orderId: order.id,
            sourceRefundCount: order.refunds.length,
            observedAnalyticsRefundEventCount: context.refunds.filter(
              (refund) =>
                refund.transactionId ===
                matches.find((match) => match.order.id === order.id)
                  ?.transaction.transactionId,
            ).length,
            comparisonBasis: 'RESOLVED_PURCHASE_TRANSACTION_ID',
            affectedCount: 1,
          },
        })),
        possibleCauses: [],
        recommendations: [],
        limitations: [
          'GA4 refund events are matched by purchase transaction ID, so multiple source refunds cannot be correlated one-to-one deterministically.',
        ],
      };
    }

    return {
      checkId: 'REFUND_COVERAGE',
      status: 'PASS',
      severity: 'INFO',
      confidence: context.mapping.confidence,
      title: 'Refund coverage detected',
      summary:
        'Every assessed refunded order has a GA4 refund event for its mapped purchase transaction.',
      metrics: {
        refundedOrderCount: refundedOrders.length,
        assessedRefundedOrderCount: matches.length,
        missingRefundedOrderCount: 0,
        affectedCount: 0,
      },
      evidence: [],
      possibleCauses: [],
      recommendations: [],
      limitations: [
        'This check verifies refund presence only; it does not compare refund amounts, currencies, items, quantities, or multiple partial-refund completeness.',
      ],
    };
  },
};
