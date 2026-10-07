import type { AuditCheck } from '../check.js';

export const itemPresenceCheck: AuditCheck = {
  id: 'ITEM_PRESENCE',

  run: (context) => {
    const { mapping } = context;

    if (mapping.status !== 'RESOLVED') {
      return {
        checkId: 'ITEM_PRESENCE',
        status:
          mapping.status === 'INSUFFICIENT_DATA'
            ? 'INSUFFICIENT_DATA'
            : 'UNKNOWN',
        severity: 'WARNING',
        confidence: mapping.confidence,
        title: 'Item presence cannot be assessed',
        summary:
          'Resolved transaction mapping is required to assess item presence.',
        metrics: {
          matchedCount: mapping.matches.length,
          affectedCount: null,
        },
        evidence: [
          {
            type: 'TRANSACTION_MAPPING_RESULT',
            description:
              'Resolved transaction mapping is required to assess item presence.',
            data: {
              mappingStatus: mapping.status,
              expectedMappingStatus: 'RESOLVED',
              mappingConfidence: mapping.confidence,
              matchedCount: mapping.matches.length,
              comparisonBasis: 'RESOLVED_TRANSACTION_MAPPING',
              affectedCount: null,
            },
          },
        ],
        possibleCauses: [],
        recommendations: [],
        limitations: [
          'Item presence cannot be assessed reliably without resolved transaction mapping.',
        ],
      };
    }

    const comparableMatches = mapping.matches.filter(
      (match) => match.order.items.length > 0,
    );

    const missingItemMatches = comparableMatches.filter(
      (match) => match.transaction.items.length === 0,
    );

    const unassessableMatches = mapping.matches.filter(
      (match) => match.order.items.length === 0,
    );

    if (missingItemMatches.length > 0) {
      return {
        checkId: 'ITEM_PRESENCE',
        status: 'FAIL',
        severity: 'WARNING',
        confidence: mapping.confidence,
        title: 'Transaction items are missing',
        summary:
          'Some mapped GA4 purchase transactions contain no item data while their source orders contain items.',
        metrics: {
          matchedCount: mapping.matches.length,
          comparableCount: comparableMatches.length,
          missingItemCount: missingItemMatches.length,
          unassessableCount: unassessableMatches.length,
          affectedCount: missingItemMatches.length,
        },
        evidence: [
          ...missingItemMatches.map((match) => ({
            type: 'MISSING_TRANSACTION_ITEMS',
            description:
              'Mapped GA4 purchase transaction contains no item data while the source order contains items.',
            data: {
              orderId: match.order.id,
              transactionId: match.transaction.transactionId,
              comparisonBasis: 'SOURCE_ORDER_HAS_ITEMS',
              expectedItemPresence: true,
              sourceItemCount: match.order.items.length,
              observedItemCount: match.transaction.items.length,
              affectedCount: 1,
            },
          })),
          ...unassessableMatches.map((match) => ({
            type: 'MISSING_SOURCE_ITEM_BASIS',
            description:
              'Mapped source order contains no item data, so GA4 item presence cannot be assessed reliably.',
            data: {
              orderId: match.order.id,
              transactionId: match.transaction.transactionId,
              comparisonBasis: 'SOURCE_ORDER_ITEM_DATA',
              expectedSourceItemPresence: true,
              sourceItemCount: match.order.items.length,
              observedItemCount: match.transaction.items.length,
              affectedCount: 1,
            },
          })),
        ],
        possibleCauses: [],
        recommendations: [],
        limitations:
          unassessableMatches.length > 0
            ? [
                'Some mapped transactions could not be assessed because their source orders contain no item data.',
              ]
            : [],
      };
    }

    if (unassessableMatches.length > 0) {
      return {
        checkId: 'ITEM_PRESENCE',
        status: 'UNKNOWN',
        severity: 'WARNING',
        confidence: mapping.confidence,
        title: 'Item presence cannot be fully determined',
        summary:
          'Some mapped source orders contain no item data, so GA4 item presence cannot be assessed reliably.',
        metrics: {
          matchedCount: mapping.matches.length,
          comparableCount: comparableMatches.length,
          missingSourceItemBasisCount: unassessableMatches.length,
          affectedCount: unassessableMatches.length,
        },
        evidence: unassessableMatches.map((match) => ({
          type: 'MISSING_SOURCE_ITEM_BASIS',
          description:
            'Mapped source order contains no item data, so GA4 item presence cannot be assessed reliably.',
          data: {
            orderId: match.order.id,
            transactionId: match.transaction.transactionId,
            comparisonBasis: 'SOURCE_ORDER_ITEM_DATA',
            expectedSourceItemPresence: true,
            sourceItemCount: match.order.items.length,
            observedItemCount: match.transaction.items.length,
            affectedCount: 1,
          },
        })),
        possibleCauses: [],
        recommendations: [],
        limitations: [
          'Item presence cannot be determined for mapped transactions whose source orders contain no item data.',
        ],
      };
    }

    return {
      checkId: 'ITEM_PRESENCE',
      status: 'PASS',
      severity: 'INFO',
      confidence: mapping.confidence,
      title: 'Transaction items are present',
      summary:
        'Mapped source orders and GA4 purchase transactions contain item data.',
      metrics: {
        matchedCount: mapping.matches.length,
        comparableCount: comparableMatches.length,
        missingItemCount: 0,
      },
      evidence: [],
      possibleCauses: [],
      recommendations: [],
      limitations: [],
    };
  },
};
