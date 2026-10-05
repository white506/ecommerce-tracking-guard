import { describe, expect, it } from 'vitest';

import { itemIdentityIntegrityCheck } from '../../../src/domain/audit/checks/item-identity-integrity.js';
import { AUDIT_POLICY_V1 } from '../../../src/domain/audit/policy.js';
import { createMoney } from '../../../src/domain/money/money.js';
import { makeOrder, makeTransaction } from '../../helpers/domain.js';

function makeContext(
  sourceIdentifier: 'id' | 'productId' | 'variantId' | 'sku',
) {
  const order = {
    ...makeOrder('order-1', 'legacy-1'),
    items: [
      {
        id: 'line-1',
        productId: 'product-1',
        variantId: 'variant-1',
        sku: 'SKU-1',
        name: 'Source item',
        quantity: 1,
        unitPrice: createMoney(1000n, 'USD'),
        total: createMoney(1000n, 'USD'),
      },
    ],
  };

  const sourceItem = order.items[0]!;
  const itemId = sourceItem[sourceIdentifier];

  if (itemId === null) {
    throw new Error('Test source identifier must be present');
  }

  const transaction = {
    ...makeTransaction('legacy-1'),
    items: [
      {
        itemId,
        itemName: 'Analytics item',
        quantity: 99,
        price: createMoney(999999n, 'USD'),
      },
    ],
  };

  const mapping = {
    status: 'RESOLVED' as const,
    confidence: 'HIGH' as const,
    matches: [
      {
        order,
        transaction,
        strategy: 'LEGACY_RESOURCE_ID' as const,
        confidence: 'HIGH' as const,
      },
    ],
    candidates: [],
  };

  return {
    orders: [order],
    transactions: [transaction],
    refunds: [],
    mapping,
  };
}

describe('itemIdentityIntegrityCheck', () => {
  it.each(['id', 'productId', 'variantId', 'sku'] as const)(
    'passes when GA4 item_id exactly matches source %s',
    (sourceIdentifier) => {
      const finding = itemIdentityIntegrityCheck.run(
        makeContext(sourceIdentifier),
        AUDIT_POLICY_V1,
      );

      expect(finding.status).toBe('PASS');
      expect(finding.severity).toBe('INFO');
      expect(finding.confidence).toBe('HIGH');
      expect(finding.metrics).toEqual({
        matchedTransactionCount: 1,
        comparableTransactionCount: 1,
        mismatchedTransactionCount: 0,
      });
      expect(finding.evidence).toEqual([]);
    },
  );

  it('returns unknown when GA4 item_id is missing even if item_name matches', () => {
    const context = makeContext('id');
    const match = context.mapping.matches[0]!;

    const transaction = {
      ...match.transaction,
      items: [
        {
          ...match.transaction.items[0]!,
          itemId: null,
          itemName: match.order.items[0]!.name,
        },
      ],
    };

    const mapping = {
      ...context.mapping,
      matches: [
        {
          ...match,
          transaction,
        },
      ],
    };

    const finding = itemIdentityIntegrityCheck.run(
      {
        orders: context.orders,
        transactions: [transaction],
        refunds: [],
        mapping,
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('UNKNOWN');
    expect(finding.severity).toBe('WARNING');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedTransactionCount: 1,
      comparableTransactionCount: 0,
      missingItemIdCount: 1,
      affectedCount: 1,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'MISSING_ANALYTICS_ITEM_ID',
        description:
          'GA4 item identity cannot be assessed because item_id is missing.',
        data: {
          orderId: 'order-1',
          transactionId: 'legacy-1',
          comparisonBasis: 'EXACT_SOURCE_ITEM_IDENTIFIER',
          expectedItemIdPresence: true,
          observedItemId: null,
        },
      },
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('returns unknown when GA4 item_id matches multiple source items', () => {
    const context = makeContext('sku');
    const match = context.mapping.matches[0]!;
    const firstItem = match.order.items[0]!;

    const order = {
      ...match.order,
      items: [
        firstItem,
        {
          ...firstItem,
          id: 'line-2',
          productId: 'product-2',
          variantId: 'variant-2',
          sku: firstItem.sku,
          name: 'Second source item',
        },
      ],
    };

    const mapping = {
      ...context.mapping,
      matches: [
        {
          ...match,
          order,
        },
      ],
    };

    const finding = itemIdentityIntegrityCheck.run(
      {
        orders: [order],
        transactions: context.transactions,
        refunds: [],
        mapping,
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('UNKNOWN');
    expect(finding.severity).toBe('WARNING');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedTransactionCount: 1,
      comparableTransactionCount: 0,
      ambiguousItemCount: 1,
      affectedCount: 1,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'AMBIGUOUS_SOURCE_ITEM_IDENTITY',
        description:
          'GA4 item_id matches multiple source items, so item identity cannot be resolved uniquely.',
        data: {
          orderId: 'order-1',
          transactionId: 'legacy-1',
          itemId: 'SKU-1',
          comparisonBasis: 'EXACT_SOURCE_ITEM_IDENTIFIER',
          candidateCount: 2,
        },
      },
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('fails when GA4 item_id matches no deterministic source identifier', () => {
    const context = makeContext('id');
    const match = context.mapping.matches[0]!;

    const transaction = {
      ...match.transaction,
      items: [
        {
          ...match.transaction.items[0]!,
          itemId: 'unknown-item',
        },
      ],
    };

    const mapping = {
      ...context.mapping,
      matches: [
        {
          ...match,
          transaction,
        },
      ],
    };

    const finding = itemIdentityIntegrityCheck.run(
      {
        orders: context.orders,
        transactions: [transaction],
        refunds: [],
        mapping,
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('FAIL');
    expect(finding.severity).toBe('WARNING');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedTransactionCount: 1,
      comparableTransactionCount: 1,
      mismatchedItemCount: 1,
      affectedCount: 1,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'UNMATCHED_ANALYTICS_ITEM_ID',
        description:
          'GA4 item_id matches no deterministic identifier of a source order item.',
        data: {
          orderId: 'order-1',
          transactionId: 'legacy-1',
          itemId: 'unknown-item',
          comparisonBasis: 'EXACT_SOURCE_ITEM_IDENTIFIER',
          candidateCount: 0,
        },
      },
    ]);
  });

  it('fails when multiple GA4 items reuse the same source item identity', () => {
    const context = makeContext('id');
    const match = context.mapping.matches[0]!;
    const firstItem = match.order.items[0]!;

    const order = {
      ...match.order,
      items: [
        firstItem,
        {
          ...firstItem,
          id: 'line-2',
          productId: 'product-2',
          variantId: 'variant-2',
          sku: 'SKU-2',
          name: 'Second source item',
        },
      ],
    };

    const analyticsItem = match.transaction.items[0]!;

    const transaction = {
      ...match.transaction,
      items: [
        analyticsItem,
        {
          ...analyticsItem,
          itemId: firstItem.id,
        },
      ],
    };

    const mapping = {
      ...context.mapping,
      matches: [
        {
          ...match,
          order,
          transaction,
        },
      ],
    };

    const finding = itemIdentityIntegrityCheck.run(
      {
        orders: [order],
        transactions: [transaction],
        refunds: [],
        mapping,
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('FAIL');
    expect(finding.severity).toBe('WARNING');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toMatchObject({
      matchedTransactionCount: 1,
      mismatchedItemCount: 1,
      affectedCount: 1,
    });

    expect(
      finding.evidence.some(
        (evidence) => evidence.type === 'REUSED_SOURCE_ITEM_IDENTITY',
      ),
    ).toBe(true);
  });

  it('returns unknown when transaction mapping is unresolved', () => {
    const context = makeContext('id');

    const finding = itemIdentityIntegrityCheck.run(
      {
        ...context,
        mapping: {
          ...context.mapping,
          status: 'UNRESOLVED',
          matches: [],
        },
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('UNKNOWN');
    expect(finding.severity).toBe('WARNING');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedTransactionCount: 0,
      affectedCount: 1,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'TRANSACTION_MAPPING_STATUS',
        description:
          'Item identity cannot be assessed because transaction mapping is not resolved.',
        data: {
          mappingStatus: 'UNRESOLVED',
          mappingConfidence: 'HIGH',
          comparisonBasis: 'RESOLVED_TRANSACTION_MAPPING',
          expectedMappingStatus: 'RESOLVED',
          affectedCount: 1,
        },
      },
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('returns insufficient data when transaction mapping has insufficient data', () => {
    const context = makeContext('id');

    const finding = itemIdentityIntegrityCheck.run(
      {
        ...context,
        mapping: {
          ...context.mapping,
          status: 'INSUFFICIENT_DATA',
          matches: [],
        },
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('INSUFFICIENT_DATA');
    expect(finding.severity).toBe('WARNING');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedTransactionCount: 0,
      affectedCount: 1,
    });
  });

  it('keeps fail priority when proven mismatch and unknown item coexist', () => {
    const context = makeContext('id');
    const match = context.mapping.matches[0]!;
    const analyticsItem = match.transaction.items[0]!;

    const transaction = {
      ...match.transaction,
      items: [
        {
          ...analyticsItem,
          itemId: 'unknown-item',
        },
        {
          ...analyticsItem,
          itemId: null,
        },
      ],
    };

    const mapping = {
      ...context.mapping,
      matches: [
        {
          ...match,
          transaction,
        },
      ],
    };

    const finding = itemIdentityIntegrityCheck.run(
      {
        orders: context.orders,
        transactions: [transaction],
        refunds: [],
        mapping,
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('FAIL');
    expect(finding.severity).toBe('WARNING');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toMatchObject({
      matchedTransactionCount: 1,
      mismatchedItemCount: 1,
      affectedCount: 1,
    });
    expect(
      finding.evidence.some(
        (evidence) => evidence.type === 'UNMATCHED_ANALYTICS_ITEM_ID',
      ),
    ).toBe(true);
    expect(
      finding.evidence.some(
        (evidence) => evidence.type === 'MISSING_ANALYTICS_ITEM_ID',
      ),
    ).toBe(true);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('passes for multiple GA4 items matched one-to-one to multiple source items', () => {
    const context = makeContext('id');
    const match = context.mapping.matches[0]!;
    const sourceItem = match.order.items[0]!;
    const analyticsItem = match.transaction.items[0]!;

    const secondSourceItem = {
      ...sourceItem,
      id: 'line-2',
      productId: 'product-2',
      variantId: 'variant-2',
      sku: 'SKU-2',
      name: 'Second source item',
    };

    const order = {
      ...match.order,
      items: [sourceItem, secondSourceItem],
    };

    const transaction = {
      ...match.transaction,
      items: [
        {
          ...analyticsItem,
          itemId: sourceItem.id,
        },
        {
          ...analyticsItem,
          itemId: secondSourceItem.id,
        },
      ],
    };

    const mapping = {
      ...context.mapping,
      matches: [
        {
          ...match,
          order,
          transaction,
        },
      ],
    };

    const finding = itemIdentityIntegrityCheck.run(
      {
        orders: [order],
        transactions: [transaction],
        refunds: [],
        mapping,
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('PASS');
    expect(finding.severity).toBe('INFO');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedTransactionCount: 1,
      comparableTransactionCount: 1,
      mismatchedTransactionCount: 0,
    });
    expect(finding.evidence).toEqual([]);
    expect(finding.limitations).toEqual([]);
  });

  it('returns not applicable when mapped GA4 transaction has no items', () => {
    const context = makeContext('id');
    const match = context.mapping.matches[0]!;

    const transaction = {
      ...match.transaction,
      items: [],
    };

    const mapping = {
      ...context.mapping,
      matches: [
        {
          ...match,
          transaction,
        },
      ],
    };

    const finding = itemIdentityIntegrityCheck.run(
      {
        orders: context.orders,
        transactions: [transaction],
        refunds: [],
        mapping,
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('NOT_APPLICABLE');
    expect(finding.severity).toBe('INFO');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedTransactionCount: 1,
      comparableTransactionCount: 0,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'ITEM_IDENTITY_NOT_ASSESSABLE',
        description:
          'Item identity cannot be compared because source or GA4 items are absent.',
        data: {
          orderId: 'order-1',
          transactionId: 'legacy-1',
          comparisonBasis: 'SOURCE_AND_ANALYTICS_ITEMS_PRESENT',
          expectedSourceItemPresence: true,
          expectedAnalyticsItemPresence: true,
          observedSourceItemCount: 1,
          observedAnalyticsItemCount: 0,
        },
      },
    ]);
    expect(finding.limitations).toEqual([
      'Item presence is evaluated separately by the Item Presence check.',
    ]);
  });

  it('does not mix item counts with transaction counts for missing item ids', () => {
    const context = makeContext('id');
    const match = context.mapping.matches[0]!;
    const analyticsItem = match.transaction.items[0]!;

    const transaction = {
      ...match.transaction,
      items: [
        { ...analyticsItem, itemId: null },
        { ...analyticsItem, itemId: null },
      ],
    };

    const mapping = {
      ...context.mapping,
      matches: [{ ...match, transaction }],
    };

    const finding = itemIdentityIntegrityCheck.run(
      {
        orders: context.orders,
        transactions: [transaction],
        refunds: [],
        mapping,
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('UNKNOWN');
    expect(finding.metrics).toEqual({
      matchedTransactionCount: 1,
      comparableTransactionCount: 0,
      missingItemIdCount: 2,
      affectedCount: 2,
    });
  });

  it('keeps fail priority when another mapped transaction has no items', () => {
    const context = makeContext('id');
    const firstMatch = context.mapping.matches[0]!;
    const analyticsItem = firstMatch.transaction.items[0]!;

    const noItemsTransaction = {
      ...firstMatch.transaction,
      transactionId: 'tx-no-items',
      items: [],
    };

    const secondOrder = {
      ...firstMatch.order,
      id: 'order-2',
      identifiers: {
        ...firstMatch.order.identifiers,
        legacyResourceId: 'legacy-2',
      },
    };

    const mismatchedTransaction = {
      ...firstMatch.transaction,
      transactionId: 'tx-mismatch',
      items: [
        {
          ...analyticsItem,
          itemId: 'unknown-item',
        },
      ],
    };

    const mapping = {
      ...context.mapping,
      matches: [
        {
          ...firstMatch,
          transaction: noItemsTransaction,
        },
        {
          ...firstMatch,
          order: secondOrder,
          transaction: mismatchedTransaction,
        },
      ],
    };

    const finding = itemIdentityIntegrityCheck.run(
      {
        orders: [firstMatch.order, secondOrder],
        transactions: [noItemsTransaction, mismatchedTransaction],
        refunds: [],
        mapping,
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('FAIL');
    expect(finding.severity).toBe('WARNING');
    expect(finding.metrics).toMatchObject({
      matchedTransactionCount: 2,
      mismatchedItemCount: 1,
      affectedCount: 1,
    });
    expect(
      finding.evidence.some(
        (evidence) => evidence.type === 'UNMATCHED_ANALYTICS_ITEM_ID',
      ),
    ).toBe(true);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('returns unknown when valid item identities coexist with an unassessable transaction', () => {
    const context = makeContext('id');
    const firstMatch = context.mapping.matches[0]!;

    const secondOrder = {
      ...firstMatch.order,
      id: 'order-2',
      identifiers: {
        ...firstMatch.order.identifiers,
        legacyResourceId: 'legacy-2',
      },
    };

    const noItemsTransaction = {
      ...firstMatch.transaction,
      transactionId: 'tx-no-items',
      items: [],
    };

    const mapping = {
      ...context.mapping,
      matches: [
        firstMatch,
        {
          ...firstMatch,
          order: secondOrder,
          transaction: noItemsTransaction,
        },
      ],
    };

    const finding = itemIdentityIntegrityCheck.run(
      {
        orders: [firstMatch.order, secondOrder],
        transactions: [firstMatch.transaction, noItemsTransaction],
        refunds: [],
        mapping,
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('UNKNOWN');
    expect(finding.severity).toBe('WARNING');
    expect(finding.metrics).toMatchObject({
      matchedTransactionCount: 2,
      comparableTransactionCount: 1,
      unassessableTransactionCount: 1,
      affectedCount: 1,
    });
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('keeps ambiguity evidence when proven mismatch also exists', () => {
    const context = makeContext('id');
    const match = context.mapping.matches[0]!;
    const sourceItem = match.order.items[0]!;
    const analyticsItem = match.transaction.items[0]!;

    const ambiguousSourceItem = {
      ...sourceItem,
      id: 'source-item-2',
      sku: sourceItem.id,
    };

    const order = {
      ...match.order,
      items: [sourceItem, ambiguousSourceItem],
    };

    const transaction = {
      ...match.transaction,
      items: [
        {
          ...analyticsItem,
          itemId: 'unknown-item',
        },
        {
          ...analyticsItem,
          itemId: sourceItem.id,
        },
      ],
    };

    const mapping = {
      ...context.mapping,
      matches: [{ ...match, order, transaction }],
    };

    const finding = itemIdentityIntegrityCheck.run(
      {
        orders: [order],
        transactions: [transaction],
        refunds: [],
        mapping,
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('FAIL');
    expect(
      finding.evidence.some(
        (evidence) => evidence.type === 'UNMATCHED_ANALYTICS_ITEM_ID',
      ),
    ).toBe(true);
    expect(
      finding.evidence.some(
        (evidence) => evidence.type === 'AMBIGUOUS_SOURCE_ITEM_IDENTITY',
      ),
    ).toBe(true);
  });
});
