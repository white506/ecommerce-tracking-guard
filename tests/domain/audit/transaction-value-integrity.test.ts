import { describe, expect, it } from 'vitest';

import { transactionValueIntegrityCheck } from '../../../src/domain/audit/checks/transaction-value-integrity.js';
import { AUDIT_POLICY_V1 } from '../../../src/domain/audit/policy.js';
import { createMoney } from '../../../src/domain/money/money.js';
import { RESOLVER_POLICY_V1 } from '../../../src/domain/resolver/policy.js';
import { resolveTransactions } from '../../../src/domain/resolver/resolver.js';
import { makeOrder, makeTransaction } from '../../helpers/domain.js';

describe('transactionValueIntegrityCheck', () => {
  it.each([
    ['UNRESOLVED', 'UNKNOWN'],
    ['AMBIGUOUS', 'UNKNOWN'],
    ['INSUFFICIENT_DATA', 'INSUFFICIENT_DATA'],
  ] as const)('returns %s mapping as %s', (mappingStatus, expectedStatus) => {
    const finding = transactionValueIntegrityCheck.run(
      {
        orders: [],
        transactions: [],
        refunds: [],
        mapping: {
          status: mappingStatus,
          confidence: 'LOW',
          matches: [],
          candidates: [],
        },
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.checkId).toBe('TRANSACTION_VALUE_INTEGRITY');
    expect(finding.status).toBe(expectedStatus);
    expect(finding.confidence).toBe('LOW');
    expect(finding.evidence.length).toBeGreaterThan(0);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('returns UNKNOWN when a mapped GA4 transaction has no value', () => {
    const orders = Array.from({ length: 5 }, (_, index) => ({
      ...makeOrder(`order-${index}`, `legacy-${index}`),
      items: [
        {
          id: `item-${index}`,
          productId: null,
          variantId: null,
          sku: null,
          name: `Item ${index}`,
          quantity: 1,
          unitPrice: createMoney(1000n, 'USD'),
          total: createMoney(1000n, 'USD'),
        },
      ],
    }));
    const transactions = Array.from({ length: 5 }, (_, index) => {
      const transaction = makeTransaction(`legacy-${index}`);

      return index === 4 ? { ...transaction, value: null } : transaction;
    });
    const mapping = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(mapping.status).toBe('RESOLVED');
    expect(mapping.confidence).toBe('HIGH');

    const finding = transactionValueIntegrityCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.checkId).toBe('TRANSACTION_VALUE_INTEGRITY');
    expect(finding.status).toBe('UNKNOWN');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedCount: 5,
      comparableCount: 4,
      missingValueCount: 1,
      affectedCount: 1,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'MISSING_TRANSACTION_VALUE',
        description:
          'Mapped GA4 purchase transaction has no value available for comparison.',
        data: {
          orderId: 'order-4',
          transactionId: 'legacy-4',
        },
      },
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('passes when mapped GA4 values equal source item totals', () => {
    const orders = Array.from({ length: 5 }, (_, index) => ({
      ...makeOrder(`order-${index}`, `legacy-${index}`),
      items: [
        {
          id: `item-${index}`,
          productId: null,
          variantId: null,
          sku: null,
          name: `Item ${index}`,
          quantity: 1,
          unitPrice: createMoney(1000n, 'USD'),
          total: createMoney(1000n, 'USD'),
        },
      ],
    }));
    const transactions = Array.from({ length: 5 }, (_, index) =>
      makeTransaction(`legacy-${index}`),
    );
    const mapping = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(mapping.status).toBe('RESOLVED');

    const finding = transactionValueIntegrityCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.checkId).toBe('TRANSACTION_VALUE_INTEGRITY');
    expect(finding.status).toBe('PASS');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedCount: 5,
      comparableCount: 5,
      mismatchCount: 0,
    });
    expect(finding.evidence).toEqual([]);
  });

  it('returns UNKNOWN when a mapped source order has no item basis', () => {
    const orders = Array.from({ length: 5 }, (_, index) =>
      makeOrder(`order-${index}`, `legacy-${index}`),
    );
    const transactions = Array.from({ length: 5 }, (_, index) =>
      makeTransaction(`legacy-${index}`),
    );
    const mapping = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(mapping.status).toBe('RESOLVED');

    const finding = transactionValueIntegrityCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.checkId).toBe('TRANSACTION_VALUE_INTEGRITY');
    expect(finding.status).toBe('UNKNOWN');
    expect(finding.metrics).toEqual({
      matchedCount: 5,
      comparableCount: 0,
      missingItemBasisCount: 5,
      affectedCount: 5,
    });
    expect(finding.evidence).toHaveLength(5);
    expect(finding.evidence[0]).toEqual({
      type: 'MISSING_ITEM_VALUE_BASIS',
      description:
        'Mapped source order has no item totals available for transaction value comparison.',
      data: {
        orderId: 'order-0',
        transactionId: 'legacy-0',
      },
    });
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('returns UNKNOWN when mapped values cannot be compared in the same currency', () => {
    const orders = Array.from({ length: 5 }, (_, index) => ({
      ...makeOrder(`order-${index}`, `legacy-${index}`),
      items: [
        {
          id: `item-${index}`,
          productId: null,
          variantId: null,
          sku: null,
          name: `Item ${index}`,
          quantity: 1,
          unitPrice: createMoney(1000n, 'USD'),
          total: createMoney(1000n, 'USD'),
        },
      ],
    }));
    const transactions = Array.from({ length: 5 }, (_, index) => {
      const transaction = makeTransaction(`legacy-${index}`);

      return index === 4
        ? {
            ...transaction,
            value: createMoney(1000n, 'EUR'),
            currency: 'EUR',
          }
        : transaction;
    });
    const mapping = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(mapping.status).toBe('RESOLVED');

    const finding = transactionValueIntegrityCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.checkId).toBe('TRANSACTION_VALUE_INTEGRITY');
    expect(finding.status).toBe('UNKNOWN');
    expect(finding.metrics).toEqual({
      matchedCount: 5,
      comparableCount: 4,
      currencyMismatchCount: 1,
      affectedCount: 1,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'INCOMPARABLE_TRANSACTION_CURRENCY',
        description:
          'GA4 transaction value and source item totals use different currencies.',
        data: {
          orderId: 'order-4',
          transactionId: 'legacy-4',
          sourceCurrency: 'USD',
          observedCurrency: 'EUR',
        },
      },
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('fails when a mapped GA4 value differs from the source item total', () => {
    const orders = Array.from({ length: 5 }, (_, index) => ({
      ...makeOrder(`order-${index}`, `legacy-${index}`),
      items: [
        {
          id: `item-${index}`,
          productId: null,
          variantId: null,
          sku: null,
          name: `Item ${index}`,
          quantity: 1,
          unitPrice: createMoney(1000n, 'USD'),
          total: createMoney(1000n, 'USD'),
        },
      ],
    }));
    const transactions = Array.from({ length: 5 }, (_, index) => {
      const transaction = makeTransaction(`legacy-${index}`);

      return index === 4
        ? {
            ...transaction,
            value: createMoney(900n, 'USD'),
          }
        : transaction;
    });
    const mapping = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(mapping.status).toBe('RESOLVED');

    const finding = transactionValueIntegrityCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.checkId).toBe('TRANSACTION_VALUE_INTEGRITY');
    expect(finding.status).toBe('FAIL');
    expect(finding.severity).toBe('WARNING');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedCount: 5,
      comparableCount: 5,
      mismatchCount: 1,
      affectedCount: 1,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'TRANSACTION_VALUE_MISMATCH',
        description:
          'GA4 transaction value differs from the source item total.',
        data: {
          orderId: 'order-4',
          transactionId: 'legacy-4',
          comparisonBasis: 'SUM_SOURCE_ITEM_TOTALS',
          expectedAmountMinor: '1000',
          observedAmountMinor: '900',
          differenceMinor: '100',
          currency: 'USD',
        },
      },
    ]);
  });

  it('sums multiple source item totals before comparing transaction value', () => {
    const orders = Array.from({ length: 5 }, (_, index) => ({
      ...makeOrder(`order-${index}`, `legacy-${index}`),
      items:
        index === 4
          ? [
              {
                id: 'item-4-a',
                productId: null,
                variantId: null,
                sku: null,
                name: 'Item 4A',
                quantity: 1,
                unitPrice: createMoney(400n, 'USD'),
                total: createMoney(400n, 'USD'),
              },
              {
                id: 'item-4-b',
                productId: null,
                variantId: null,
                sku: null,
                name: 'Item 4B',
                quantity: 1,
                unitPrice: createMoney(600n, 'USD'),
                total: createMoney(600n, 'USD'),
              },
            ]
          : [
              {
                id: `item-${index}`,
                productId: null,
                variantId: null,
                sku: null,
                name: `Item ${index}`,
                quantity: 1,
                unitPrice: createMoney(1000n, 'USD'),
                total: createMoney(1000n, 'USD'),
              },
            ],
    }));

    const transactions = Array.from({ length: 5 }, (_, index) =>
      makeTransaction(`legacy-${index}`),
    );

    const mapping = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    const finding = transactionValueIntegrityCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('PASS');
    expect(finding.metrics).toEqual({
      matchedCount: 5,
      comparableCount: 5,
      mismatchCount: 0,
    });
    expect(finding.evidence).toEqual([]);
  });

  it('fails on proven mismatch even when another mapped value is unavailable', () => {
    const orders = Array.from({ length: 5 }, (_, index) => ({
      ...makeOrder(`order-${index}`, `legacy-${index}`),
      items: [
        {
          id: `item-${index}`,
          productId: null,
          variantId: null,
          sku: null,
          name: `Item ${index}`,
          quantity: 1,
          unitPrice: createMoney(1000n, 'USD'),
          total: createMoney(1000n, 'USD'),
        },
      ],
    }));

    const transactions = Array.from({ length: 5 }, (_, index) => {
      const transaction = makeTransaction(`legacy-${index}`);

      if (index === 3) {
        return { ...transaction, value: null };
      }

      if (index === 4) {
        return {
          ...transaction,
          value: createMoney(900n, 'USD'),
        };
      }

      return transaction;
    });

    const mapping = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(mapping.status).toBe('RESOLVED');

    const finding = transactionValueIntegrityCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('FAIL');
    expect(finding.severity).toBe('WARNING');
    expect(finding.metrics).toEqual({
      matchedCount: 5,
      comparableCount: 4,
      mismatchCount: 1,
      unassessableCount: 1,
      affectedCount: 1,
    });

    expect(finding.evidence).toContainEqual({
      type: 'TRANSACTION_VALUE_MISMATCH',
      description: 'GA4 transaction value differs from the source item total.',
      data: {
        orderId: 'order-4',
        transactionId: 'legacy-4',
        comparisonBasis: 'SUM_SOURCE_ITEM_TOTALS',
        expectedAmountMinor: '1000',
        observedAmountMinor: '900',
        differenceMinor: '100',
        currency: 'USD',
      },
    });

    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('aggregates multiple unassessable reasons when no proven mismatch exists', () => {
    const orders = Array.from({ length: 5 }, (_, index) => ({
      ...makeOrder(`order-${index}`, `legacy-${index}`),
      items:
        index === 3
          ? []
          : [
              {
                id: `item-${index}`,
                productId: null,
                variantId: null,
                sku: null,
                name: `Item ${index}`,
                quantity: 1,
                unitPrice: createMoney(1000n, 'USD'),
                total: createMoney(1000n, 'USD'),
              },
            ],
    }));

    const transactions = Array.from({ length: 5 }, (_, index) => {
      const transaction = makeTransaction(`legacy-${index}`);

      if (index === 2) {
        return { ...transaction, value: null };
      }

      if (index === 4) {
        return {
          ...transaction,
          value: createMoney(1000n, 'EUR'),
          currency: 'EUR',
        };
      }

      return transaction;
    });

    const mapping = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(mapping.status).toBe('RESOLVED');

    const finding = transactionValueIntegrityCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('UNKNOWN');
    expect(finding.metrics).toEqual({
      matchedCount: 5,
      comparableCount: 2,
      missingValueCount: 1,
      missingItemBasisCount: 1,
      currencyMismatchCount: 1,
      affectedCount: 3,
    });

    expect(finding.evidence).toHaveLength(3);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });
});
