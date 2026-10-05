import type { CanonicalOrderItem } from '../../commerce/models.js';
import type { AuditCheck } from '../check.js';

function getSourceIdentifiers(item: CanonicalOrderItem): readonly string[] {
  return [item.id, item.productId, item.variantId, item.sku].filter(
    (identifier): identifier is string => identifier !== null,
  );
}

type ClassifiedItem = Readonly<{
  match: Parameters<AuditCheck['run']>[0]['mapping']['matches'][number];
  itemId: string | null;
  kind: 'MATCHED' | 'MISSING_ID' | 'AMBIGUOUS' | 'UNMATCHED';
  candidateCount: number;
  sourceItemId: string | null;
}>;

function findSourceCandidates(
  itemId: string,
  items: readonly CanonicalOrderItem[],
): readonly CanonicalOrderItem[] {
  return items.filter((item) => getSourceIdentifiers(item).includes(itemId));
}

function classifyItems(
  matches: Parameters<AuditCheck['run']>[0]['mapping']['matches'],
): readonly ClassifiedItem[] {
  return matches.flatMap((match) =>
    match.transaction.items.map((item): ClassifiedItem => {
      if (item.itemId === null) {
        return {
          match,
          itemId: null,
          kind: 'MISSING_ID',
          candidateCount: 0,
          sourceItemId: null,
        };
      }

      const candidates = findSourceCandidates(item.itemId, match.order.items);

      if (candidates.length === 0) {
        return {
          match,
          itemId: item.itemId,
          kind: 'UNMATCHED',
          candidateCount: 0,
          sourceItemId: null,
        };
      }

      if (candidates.length > 1) {
        return {
          match,
          itemId: item.itemId,
          kind: 'AMBIGUOUS',
          candidateCount: candidates.length,
          sourceItemId: null,
        };
      }

      return {
        match,
        itemId: item.itemId,
        kind: 'MATCHED',
        candidateCount: 1,
        sourceItemId: candidates[0]!.id,
      };
    }),
  );
}

export const itemIdentityIntegrityCheck: AuditCheck = {
  id: 'ITEM_IDENTITY_INTEGRITY',

  run: (context) => {
    const { mapping } = context;

    if (mapping.status !== 'RESOLVED') {
      const status =
        mapping.status === 'INSUFFICIENT_DATA'
          ? 'INSUFFICIENT_DATA'
          : 'UNKNOWN';

      const affectedCount = context.orders.length;

      return {
        checkId: 'ITEM_IDENTITY_INTEGRITY',
        status,
        severity: 'WARNING',
        confidence: mapping.confidence,
        title: 'Item identity cannot be assessed',
        summary:
          'Item identity cannot be assessed because transaction mapping is not resolved.',
        metrics: {
          matchedTransactionCount: mapping.matches.length,
          affectedCount,
        },
        evidence: [
          {
            type: 'TRANSACTION_MAPPING_STATUS',
            description:
              'Item identity cannot be assessed because transaction mapping is not resolved.',
            data: {
              mappingStatus: mapping.status,
              mappingConfidence: mapping.confidence,
              comparisonBasis: 'RESOLVED_TRANSACTION_MAPPING',
              expectedMappingStatus: 'RESOLVED',
              affectedCount,
            },
          },
        ],
        possibleCauses: [],
        recommendations: [],
        limitations: [
          'Reliable item identity comparison requires resolved transaction mapping.',
        ],
      };
    }

    const comparableMatches = mapping.matches.filter(
      (match) =>
        match.order.items.length > 0 && match.transaction.items.length > 0,
    );

    const unassessableMatches = mapping.matches.filter(
      (match) =>
        match.order.items.length === 0 || match.transaction.items.length === 0,
    );

    if (comparableMatches.length === 0) {
      return {
        checkId: 'ITEM_IDENTITY_INTEGRITY',
        status: 'NOT_APPLICABLE',
        severity: 'INFO',
        confidence: mapping.confidence,
        title: 'Item identity is not applicable',
        summary:
          'Item identity cannot be compared because one or more mapped transactions have no source or GA4 items.',
        metrics: {
          matchedTransactionCount: mapping.matches.length,
          comparableTransactionCount: 0,
        },
        evidence: unassessableMatches.map((match) => ({
          type: 'ITEM_IDENTITY_NOT_ASSESSABLE',
          description:
            'Item identity cannot be compared because source or GA4 items are absent.',
          data: {
            orderId: match.order.id,
            transactionId: match.transaction.transactionId,
            comparisonBasis: 'SOURCE_AND_ANALYTICS_ITEMS_PRESENT',
            expectedSourceItemPresence: true,
            expectedAnalyticsItemPresence: true,
            observedSourceItemCount: match.order.items.length,
            observedAnalyticsItemCount: match.transaction.items.length,
          },
        })),
        possibleCauses: [],
        recommendations: [],
        limitations: [
          'Item presence is evaluated separately by the Item Presence check.',
        ],
      };
    }

    const classifiedItems = classifyItems(comparableMatches);

    const unassessableTransactionCount = unassessableMatches.length;

    const unmatchedItems = classifiedItems.filter(
      (item) => item.kind === 'UNMATCHED',
    );

    const matchedItems = classifiedItems.filter(
      (item) => item.kind === 'MATCHED',
    );

    const usedSourceItems = new Set<string>();
    const reusedItems = [];

    for (const item of matchedItems) {
      if (item.sourceItemId === null) {
        continue;
      }

      const key = `${item.match.order.id}:${item.sourceItemId}`;

      if (usedSourceItems.has(key)) {
        reusedItems.push(item);
        continue;
      }

      usedSourceItems.add(key);
    }

    const missingItemIdItems = classifiedItems.filter(
      (item) => item.kind === 'MISSING_ID',
    );

    const transactionsWithMissingItemId = new Set(
      missingItemIdItems.map((item) => item.match.transaction.transactionId),
    );

    const ambiguousItems = classifiedItems.filter(
      (item) => item.kind === 'AMBIGUOUS',
    );

    if (unmatchedItems.length > 0 || reusedItems.length > 0) {
      const affectedCount = unmatchedItems.length + reusedItems.length;

      return {
        checkId: 'ITEM_IDENTITY_INTEGRITY',
        status: 'FAIL',
        severity: 'WARNING',
        confidence: mapping.confidence,
        title: 'Item identities are inconsistent',
        summary:
          'Some GA4 item identities cannot be matched one-to-one to deterministic source item identifiers.',
        metrics: {
          matchedTransactionCount: mapping.matches.length,
          comparableTransactionCount: comparableMatches.length,
          mismatchedItemCount: affectedCount,
          ...(missingItemIdItems.length > 0
            ? { unassessableItemCount: missingItemIdItems.length }
            : {}),
          ...(ambiguousItems.length > 0
            ? { ambiguousItemCount: ambiguousItems.length }
            : {}),
          ...(unassessableTransactionCount > 0
            ? { unassessableTransactionCount }
            : {}),
          affectedCount,
        },
        evidence: [
          ...unmatchedItems.map((item) => ({
            type: 'UNMATCHED_ANALYTICS_ITEM_ID',
            description:
              'GA4 item_id matches no deterministic identifier of a source order item.',
            data: {
              orderId: item.match.order.id,
              transactionId: item.match.transaction.transactionId,
              itemId: item.itemId,
              comparisonBasis: 'EXACT_SOURCE_ITEM_IDENTIFIER',
              candidateCount: item.candidateCount,
            },
          })),
          ...reusedItems.map((item) => ({
            type: 'REUSED_SOURCE_ITEM_IDENTITY',
            description:
              'Multiple GA4 items resolve to the same source item identity.',
            data: {
              orderId: item.match.order.id,
              transactionId: item.match.transaction.transactionId,
              itemId: item.itemId,
              sourceItemId: item.sourceItemId,
              comparisonBasis: 'ONE_TO_ONE_SOURCE_ITEM_IDENTITY',
            },
          })),
          ...ambiguousItems.map((item) => ({
            type: 'AMBIGUOUS_SOURCE_ITEM_IDENTITY',
            description:
              'GA4 item_id matches multiple source items, so item identity cannot be resolved uniquely.',
            data: {
              orderId: item.match.order.id,
              transactionId: item.match.transaction.transactionId,
              itemId: item.itemId,
              comparisonBasis: 'EXACT_SOURCE_ITEM_IDENTIFIER',
              candidateCount: item.candidateCount,
            },
          })),
          ...missingItemIdItems.map((item) => ({
            type: 'MISSING_ANALYTICS_ITEM_ID',
            description:
              'GA4 item identity cannot be assessed because item_id is missing.',
            data: {
              orderId: item.match.order.id,
              transactionId: item.match.transaction.transactionId,
              comparisonBasis: 'EXACT_SOURCE_ITEM_IDENTIFIER',
              expectedItemIdPresence: true,
              observedItemId: null,
            },
          })),
        ],
        possibleCauses: [],
        recommendations: [],
        limitations: [
          ...(missingItemIdItems.length > 0
            ? [
                'Some GA4 items have no item_id and remain unassessable independently of the proven identity mismatch.',
              ]
            : []),
          ...(ambiguousItems.length > 0
            ? [
                'Some GA4 item identities remain ambiguous independently of the proven identity mismatch.',
              ]
            : []),
          ...(unassessableTransactionCount > 0
            ? [
                'Some mapped transactions have no source or GA4 items and are excluded from item identity comparison.',
              ]
            : []),
        ],
      };
    }

    if (ambiguousItems.length > 0) {
      return {
        checkId: 'ITEM_IDENTITY_INTEGRITY',
        status: 'UNKNOWN',
        severity: 'WARNING',
        confidence: mapping.confidence,
        title: 'Item identity is ambiguous',
        summary:
          'Some GA4 item_id values match multiple source items, so item identity cannot be resolved uniquely.',
        metrics: {
          matchedTransactionCount: mapping.matches.length,
          comparableTransactionCount: 0,
          ambiguousItemCount: ambiguousItems.length,
          affectedCount: ambiguousItems.length,
        },
        evidence: ambiguousItems.map((item) => ({
          type: 'AMBIGUOUS_SOURCE_ITEM_IDENTITY',
          description:
            'GA4 item_id matches multiple source items, so item identity cannot be resolved uniquely.',
          data: {
            orderId: item.match.order.id,
            transactionId: item.match.transaction.transactionId,
            itemId: item.itemId,
            comparisonBasis: 'EXACT_SOURCE_ITEM_IDENTIFIER',
            candidateCount: item.candidateCount,
          },
        })),
        possibleCauses: [],
        recommendations: [],
        limitations: [
          'Ambiguous source identifiers prevent deterministic one-to-one item identity resolution.',
        ],
      };
    }

    if (missingItemIdItems.length > 0) {
      return {
        checkId: 'ITEM_IDENTITY_INTEGRITY',
        status: 'UNKNOWN',
        severity: 'WARNING',
        confidence: mapping.confidence,
        title: 'Item identity cannot be fully determined',
        summary:
          'Some mapped GA4 items have no item_id, so their identity cannot be assessed reliably.',
        metrics: {
          matchedTransactionCount: mapping.matches.length,
          comparableTransactionCount:
            mapping.matches.length - transactionsWithMissingItemId.size,
          missingItemIdCount: missingItemIdItems.length,
          affectedCount: missingItemIdItems.length,
        },
        evidence: missingItemIdItems.map((item) => ({
          type: 'MISSING_ANALYTICS_ITEM_ID',
          description:
            'GA4 item identity cannot be assessed because item_id is missing.',
          data: {
            orderId: item.match.order.id,
            transactionId: item.match.transaction.transactionId,
            comparisonBasis: 'EXACT_SOURCE_ITEM_IDENTIFIER',
            expectedItemIdPresence: true,
            observedItemId: null,
          },
        })),
        possibleCauses: [],
        recommendations: [],
        limitations: [
          'Item identity cannot be determined for GA4 items without item_id.',
        ],
      };
    }

    if (unassessableTransactionCount > 0) {
      return {
        checkId: 'ITEM_IDENTITY_INTEGRITY',
        status: 'UNKNOWN',
        severity: 'WARNING',
        confidence: mapping.confidence,
        title: 'Item identity cannot be fully determined',
        summary:
          'Some mapped transactions cannot be included in item identity comparison.',
        metrics: {
          matchedTransactionCount: mapping.matches.length,
          comparableTransactionCount: comparableMatches.length,
          unassessableTransactionCount,
          affectedCount: unassessableTransactionCount,
        },
        evidence: unassessableMatches.map((match) => ({
          type: 'ITEM_IDENTITY_NOT_ASSESSABLE',
          description:
            'This mapped transaction is excluded from item identity comparison because source or GA4 items are absent.',
          data: {
            orderId: match.order.id,
            transactionId: match.transaction.transactionId,
            comparisonBasis: 'SOURCE_AND_ANALYTICS_ITEMS_PRESENT',
            expectedSourceItemPresence: true,
            expectedAnalyticsItemPresence: true,
            observedSourceItemCount: match.order.items.length,
            observedAnalyticsItemCount: match.transaction.items.length,
          },
        })),
        possibleCauses: [],
        recommendations: [],
        limitations: [
          'Some mapped transactions have no source or GA4 items and are excluded from item identity comparison.',
          'Item presence is evaluated separately by the Item Presence check.',
        ],
      };
    }

    return {
      checkId: 'ITEM_IDENTITY_INTEGRITY',
      status: 'PASS',
      severity: 'INFO',
      confidence: mapping.confidence,
      title: 'Item identities are consistent',
      summary:
        'Mapped GA4 items exactly match deterministic source item identifiers.',
      metrics: {
        matchedTransactionCount: mapping.matches.length,
        comparableTransactionCount: mapping.matches.length,
        mismatchedTransactionCount: 0,
      },
      evidence: [],
      possibleCauses: [],
      recommendations: [],
      limitations: [],
    };
  },
};
