import { describe, expect, it } from 'vitest';

import { currencyIntegrityCheck } from '../../../src/domain/audit/checks/currency-integrity.js';
import { AUDIT_POLICY_V1 } from '../../../src/domain/audit/policy.js';
import { createMoney } from '../../../src/domain/money/money.js';
import { resolveTransactions } from '../../../src/domain/resolver/resolver.js';
import { RESOLVER_POLICY_V1 } from '../../../src/domain/resolver/policy.js';
import { makeOrder, makeTransaction } from '../../helpers/domain.js';

describe('currencyIntegrityCheck', () => {
  it.each([
    ['UNRESOLVED', 'UNKNOWN'],
    ['AMBIGUOUS', 'UNKNOWN'],
    ['INSUFFICIENT_DATA', 'INSUFFICIENT_DATA'],
  ] as const)('returns %s mapping as %s', (mappingStatus, expectedStatus) => {
    const finding = currencyIntegrityCheck.run(
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

    expect(finding.status).toBe(expectedStatus);
    expect(finding.severity).toBe('WARNING');
    expect(finding.confidence).toBe('LOW');
    expect(finding.metrics).toEqual({
      matchedCount: 0,
    });
    expect(finding.evidence).toHaveLength(1);
    expect(finding.evidence[0]?.type).toBe('TRANSACTION_MAPPING_RESULT');
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('passes when mapped Shopify and GA4 currencies match', () => {
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

    const finding = currencyIntegrityCheck.run(
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
      mismatchCount: 0,
    });
    expect(finding.evidence).toEqual([]);
  });

  it('fails when a mapped GA4 currency differs from the source order currency', () => {
    const orders = Array.from({ length: 5 }, (_, index) =>
      makeOrder(`order-${index}`, `legacy-${index}`),
    );
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

    const finding = currencyIntegrityCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(mapping.status).toBe('RESOLVED');
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
        type: 'TRANSACTION_CURRENCY_MISMATCH',
        description:
          'GA4 transaction currency differs from the source order currency.',
        data: {
          orderId: 'order-4',
          transactionId: 'legacy-4',
          expectedCurrency: 'USD',
          observedCurrency: 'EUR',
        },
      },
    ]);
  });

  it('returns UNKNOWN when a mapped GA4 transaction has no currency', () => {
    const orders = Array.from({ length: 5 }, (_, index) =>
      makeOrder(`order-${index}`, `legacy-${index}`),
    );
    const transactions = Array.from({ length: 5 }, (_, index) => {
      const transaction = makeTransaction(`legacy-${index}`);

      return index === 4 ? { ...transaction, currency: null } : transaction;
    });

    const mapping = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    const finding = currencyIntegrityCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(mapping.status).toBe('RESOLVED');
    expect(finding.status).toBe('UNKNOWN');
    expect(finding.severity).toBe('WARNING');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedCount: 5,
      comparableCount: 4,
      missingCurrencyCount: 1,
      affectedCount: 1,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'MISSING_TRANSACTION_CURRENCY',
        description:
          'Mapped GA4 transaction has no currency available for comparison.',
        data: {
          orderId: 'order-4',
          transactionId: 'legacy-4',
          expectedCurrency: 'USD',
          observedCurrency: null,
        },
      },
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('keeps FAIL when a mismatch exists alongside a missing currency', () => {
    const orders = Array.from({ length: 5 }, (_, index) =>
      makeOrder(`order-${index}`, `legacy-${index}`),
    );
    const transactions = Array.from({ length: 5 }, (_, index) => {
      const transaction = makeTransaction(`legacy-${index}`);

      if (index === 3) {
        return {
          ...transaction,
          value: createMoney(1000n, 'EUR'),
          currency: 'EUR',
        };
      }

      return index === 4 ? { ...transaction, currency: null } : transaction;
    });

    const mapping = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    const finding = currencyIntegrityCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('FAIL');
    expect(finding.metrics).toEqual({
      matchedCount: 5,
      comparableCount: 4,
      mismatchCount: 1,
      missingCurrencyCount: 1,
      affectedCount: 1,
    });
    expect(finding.evidence.map((evidence) => evidence.type)).toEqual([
      'TRANSACTION_CURRENCY_MISMATCH',
      'MISSING_TRANSACTION_CURRENCY',
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('fails when GA4 transaction currency conflicts with value currency', () => {
    const orders = Array.from({ length: 5 }, (_, index) =>
      makeOrder(`order-${index}`, `legacy-${index}`),
    );
    const transactions = Array.from({ length: 5 }, (_, index) => {
      const transaction = makeTransaction(`legacy-${index}`);

      return index === 4
        ? {
            ...transaction,
            value: createMoney(1000n, 'EUR'),
            currency: 'USD',
          }
        : transaction;
    });

    const mapping = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    const finding = currencyIntegrityCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(mapping.status).toBe('RESOLVED');
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
        type: 'TRANSACTION_VALUE_CURRENCY_MISMATCH',
        description:
          'GA4 transaction currency conflicts with its transaction value currency.',
        data: {
          orderId: 'order-4',
          transactionId: 'legacy-4',
          transactionCurrency: 'USD',
          valueCurrency: 'EUR',
        },
      },
    ]);
  });
});
