import { describe, expect, it } from 'vitest';

import { itemPresenceCheck } from '../../../src/domain/audit/checks/item-presence.js';
import { AUDIT_POLICY_V1 } from '../../../src/domain/audit/policy.js';
import { RESOLVER_POLICY_V1 } from '../../../src/domain/resolver/policy.js';
import { resolveTransactions } from '../../../src/domain/resolver/resolver.js';
import { createMoney } from '../../../src/domain/money/money.js';
import { makeOrder, makeTransaction } from '../../helpers/domain.js';

describe('itemPresenceCheck', () => {
  it('passes when mapped source orders and GA4 transactions both contain items', () => {
    const orders = Array.from({ length: 5 }, (_, index) => ({
      ...makeOrder(`order-${index}`, `legacy-${index}`),
      items: [
        {
          id: `item-${index}`,
          productId: `product-${index}`,
          variantId: null,
          sku: `SKU-${index}`,
          name: `Item ${index}`,
          quantity: 1,
          unitPrice: createMoney(1000n, 'USD'),
          total: createMoney(1000n, 'USD'),
        },
      ],
    }));

    const transactions = Array.from({ length: 5 }, (_, index) => ({
      ...makeTransaction(`legacy-${index}`),
      items: [
        {
          itemId: `item-${index}`,
          itemName: `Item ${index}`,
          quantity: 1,
          price: createMoney(1000n, 'USD'),
        },
      ],
    }));

    const mapping = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    const finding = itemPresenceCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(mapping.status).toBe('RESOLVED');
    expect(finding.status).toBe('PASS');
    expect(finding.severity).toBe('INFO');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedCount: 5,
      comparableCount: 5,
      missingItemCount: 0,
    });
    expect(finding.evidence).toEqual([]);
  });

  it('fails when a mapped GA4 transaction has no items for a source order with items', () => {
    const order = {
      ...makeOrder('order-1', 'legacy-1'),
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          variantId: null,
          sku: 'SKU-1',
          name: 'Item 1',
          quantity: 1,
          unitPrice: createMoney(1000n, 'USD'),
          total: createMoney(1000n, 'USD'),
        },
      ],
    };

    const transaction = makeTransaction('legacy-1');

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

    const finding = itemPresenceCheck.run(
      { orders: [order], transactions: [transaction], refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('FAIL');
    expect(finding.severity).toBe('WARNING');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedCount: 1,
      comparableCount: 1,
      missingItemCount: 1,
      unassessableCount: 0,
      affectedCount: 1,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'MISSING_TRANSACTION_ITEMS',
        description:
          'Mapped GA4 purchase transaction contains no item data while the source order contains items.',
        data: {
          orderId: 'order-1',
          transactionId: 'legacy-1',
          comparisonBasis: 'SOURCE_ORDER_HAS_ITEMS',
          expectedItemPresence: true,
          sourceItemCount: 1,
          observedItemCount: 0,
          affectedCount: 1,
        },
      },
    ]);
  });

  it('returns unknown when the source order has no item basis', () => {
    const order = makeOrder('order-1', 'legacy-1');
    const transaction = makeTransaction('legacy-1');

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

    const finding = itemPresenceCheck.run(
      { orders: [order], transactions: [transaction], refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('UNKNOWN');
    expect(finding.severity).toBe('WARNING');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedCount: 1,
      comparableCount: 0,
      missingSourceItemBasisCount: 1,
      affectedCount: 1,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'MISSING_SOURCE_ITEM_BASIS',
        description:
          'Mapped source order contains no item data, so GA4 item presence cannot be assessed reliably.',
        data: {
          orderId: 'order-1',
          transactionId: 'legacy-1',
          comparisonBasis: 'SOURCE_ORDER_ITEM_DATA',
          expectedSourceItemPresence: true,
          sourceItemCount: 0,
          observedItemCount: 0,
          affectedCount: 1,
        },
      },
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it.each([
    ['UNRESOLVED', 'UNKNOWN'],
    ['AMBIGUOUS', 'UNKNOWN'],
    ['INSUFFICIENT_DATA', 'INSUFFICIENT_DATA'],
  ] as const)('returns %s mapping as %s', (mappingStatus, expectedStatus) => {
    const mapping = {
      status: mappingStatus,
      confidence: 'LOW' as const,
      matches: [],
      candidates: [],
    };

    const finding = itemPresenceCheck.run(
      { orders: [], transactions: [], refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe(expectedStatus);
    expect(finding.severity).toBe('WARNING');
    expect(finding.confidence).toBe('LOW');
    expect(finding.metrics).toEqual({
      matchedCount: 0,
      affectedCount: null,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'TRANSACTION_MAPPING_RESULT',
        description:
          'Resolved transaction mapping is required to assess item presence.',
        data: {
          mappingStatus,
          expectedMappingStatus: 'RESOLVED',
          mappingConfidence: 'LOW',
          matchedCount: 0,
          comparisonBasis: 'RESOLVED_TRANSACTION_MAPPING',
          affectedCount: null,
        },
      },
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('keeps fail when proven missing items coexist with an unassessable source order', () => {
    const missingOrder = {
      ...makeOrder('order-1', 'legacy-1'),
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          variantId: null,
          sku: 'SKU-1',
          name: 'Item 1',
          quantity: 1,
          unitPrice: createMoney(1000n, 'USD'),
          total: createMoney(1000n, 'USD'),
        },
      ],
    };

    const unknownOrder = makeOrder('order-2', 'legacy-2');
    const missingTransaction = makeTransaction('legacy-1');
    const unknownTransaction = makeTransaction('legacy-2');

    const mapping = {
      status: 'RESOLVED' as const,
      confidence: 'HIGH' as const,
      matches: [
        {
          order: missingOrder,
          transaction: missingTransaction,
          strategy: 'LEGACY_RESOURCE_ID' as const,
          confidence: 'HIGH' as const,
        },
        {
          order: unknownOrder,
          transaction: unknownTransaction,
          strategy: 'LEGACY_RESOURCE_ID' as const,
          confidence: 'HIGH' as const,
        },
      ],
      candidates: [],
    };

    const finding = itemPresenceCheck.run(
      {
        orders: [missingOrder, unknownOrder],
        transactions: [missingTransaction, unknownTransaction],
        refunds: [],
        mapping,
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('FAIL');
    expect(finding.severity).toBe('WARNING');
    expect(finding.metrics).toEqual({
      matchedCount: 2,
      comparableCount: 1,
      missingItemCount: 1,
      unassessableCount: 1,
      affectedCount: 1,
    });
    expect(finding.evidence).toHaveLength(2);
    expect(finding.evidence.map((evidence) => evidence.type)).toEqual([
      'MISSING_TRANSACTION_ITEMS',
      'MISSING_SOURCE_ITEM_BASIS',
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });
});
