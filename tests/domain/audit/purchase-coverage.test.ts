import { describe, expect, it } from 'vitest';

import { purchaseCoverageCheck } from '../../../src/domain/audit/checks/purchase-coverage.js';
import { AUDIT_POLICY_V1 } from '../../../src/domain/audit/policy.js';
import { RESOLVER_POLICY_V1 } from '../../../src/domain/resolver/policy.js';
import { resolveTransactions } from '../../../src/domain/resolver/resolver.js';
import { makeOrder, makeTransaction } from '../../helpers/domain.js';

describe('purchaseCoverageCheck', () => {
  it('returns UNKNOWN when transaction mapping is unresolved', () => {
    const finding = purchaseCoverageCheck.run(
      {
        orders: [],
        transactions: [],
        refunds: [],
        mapping: {
          status: 'UNRESOLVED',
          confidence: 'LOW',
          matches: [],
          candidates: [],
        },
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.checkId).toBe('PURCHASE_COVERAGE');
    expect(finding.status).toBe('UNKNOWN');
    expect(finding.confidence).toBe('LOW');
    expect(finding.metrics).toEqual({
      orderCount: 0,
      transactionCount: 0,
      matchedCount: 0,
      affectedCount: null,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'TRANSACTION_MAPPING_RESULT',
        description: 'Transaction mapping required for purchase coverage.',
        data: {
          mappingStatus: 'UNRESOLVED',
          mappingConfidence: 'LOW',
          matchedCount: 0,
          observedCoverage: null,
          expectedCoverage: 1,
          comparisonBasis: 'RESOLVED_TRANSACTION_MAPPING',
          affectedCount: null,
        },
      },
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it.each([
    ['AMBIGUOUS', 'UNKNOWN'],
    ['INSUFFICIENT_DATA', 'INSUFFICIENT_DATA'],
  ] as const)('returns %s mapping as %s', (mappingStatus, expectedStatus) => {
    const finding = purchaseCoverageCheck.run(
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
    expect(finding.confidence).toBe('LOW');
    expect(finding.summary).toContain(mappingStatus);
    expect(finding.evidence.length).toBeGreaterThan(0);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('passes when all source orders are mapped to GA4 purchases', () => {
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

    const finding = purchaseCoverageCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('PASS');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      orderCount: 5,
      transactionCount: 5,
      matchedCount: 5,
      coverage: 1,
    });
  });

  it('reports partial coverage when mapping is resolved', () => {
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

    const finding = purchaseCoverageCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('WARNING');
    expect(finding.confidence).toBe('MEDIUM');
    expect(finding.metrics).toEqual({
      orderCount: 5,
      transactionCount: 5,
      matchedCount: 4,
      coverage: 0.8,
    });
    expect(finding.evidence.length).toBeGreaterThan(0);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });
});
