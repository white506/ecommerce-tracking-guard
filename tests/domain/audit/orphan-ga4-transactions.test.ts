import { describe, expect, it } from 'vitest';

import { orphanGa4TransactionsCheck } from '../../../src/domain/audit/checks/orphan-ga4-transactions.js';
import { AUDIT_POLICY_V1 } from '../../../src/domain/audit/policy.js';
import { RESOLVER_POLICY_V1 } from '../../../src/domain/resolver/policy.js';
import { resolveTransactions } from '../../../src/domain/resolver/resolver.js';
import { makeOrder, makeTransaction } from '../../helpers/domain.js';

describe('orphanGa4TransactionsCheck', () => {
  it.each([
    ['UNRESOLVED', 'UNKNOWN'],
    ['AMBIGUOUS', 'UNKNOWN'],
    ['INSUFFICIENT_DATA', 'INSUFFICIENT_DATA'],
  ] as const)('returns %s mapping as %s', (mappingStatus, expectedStatus) => {
    const finding = orphanGa4TransactionsCheck.run(
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

    expect(finding.checkId).toBe('ORPHAN_GA4_TRANSACTIONS');
    expect(finding.status).toBe(expectedStatus);
    expect(finding.confidence).toBe('LOW');
    expect(finding.metrics).toEqual({
      transactionCount: 0,
      matchedCount: 0,
      affectedCount: null,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'TRANSACTION_MAPPING_RESULT',
        description:
          'Transaction mapping required to identify orphan GA4 transactions.',
        data: {
          mappingStatus,
          mappingConfidence: 'LOW',
          matchedCount: 0,
          observedOrphanCount: null,
          expectedOrphanCount: 0,
          comparisonBasis: 'RESOLVED_TRANSACTION_MAPPING',
          affectedCount: null,
        },
      },
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('passes when every GA4 transaction has a mapped source order', () => {
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

    const finding = orphanGa4TransactionsCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.checkId).toBe('ORPHAN_GA4_TRANSACTIONS');
    expect(finding.status).toBe('PASS');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      transactionCount: 5,
      matchedCount: 5,
      orphanCount: 0,
    });
    expect(finding.evidence).toEqual([]);
  });

  it('reports evidence for a GA4 transaction with no mapped source order', () => {
    const orders = Array.from({ length: 5 }, (_, index) =>
      makeOrder(`order-${index}`, `legacy-${index}`),
    );
    const transactions = [
      ...Array.from({ length: 4 }, (_, index) =>
        makeTransaction(`legacy-${index}`),
      ),
      makeTransaction('orphan-transaction'),
    ];
    const mapping = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(mapping.status).toBe('RESOLVED');
    expect(mapping.confidence).toBe('MEDIUM');
    expect(mapping.matches).toHaveLength(4);

    const finding = orphanGa4TransactionsCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.checkId).toBe('ORPHAN_GA4_TRANSACTIONS');
    expect(finding.status).toBe('FAIL');
    expect(finding.confidence).toBe('MEDIUM');
    expect(finding.metrics).toEqual({
      transactionCount: 5,
      matchedCount: 4,
      orphanCount: 1,
      expectedOrphanCount: 0,
      affectedCount: 1,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'ORPHAN_GA4_TRANSACTION',
        description:
          'GA4 purchase transaction has no deterministically mapped source order.',
        data: {
          transactionId: 'orphan-transaction',
          observedOrphanTransaction: true,
          expectedOrphanTransaction: false,
          comparisonBasis: 'RESOLVED_TRANSACTION_MAPPING',
          affectedCount: 1,
        },
      },
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });
});
