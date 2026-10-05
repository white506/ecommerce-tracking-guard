import { describe, expect, it } from 'vitest';

import { missingPurchasesCheck } from '../../../src/domain/audit/checks/missing-purchases.js';
import { AUDIT_POLICY_V1 } from '../../../src/domain/audit/policy.js';
import { RESOLVER_POLICY_V1 } from '../../../src/domain/resolver/policy.js';
import { resolveTransactions } from '../../../src/domain/resolver/resolver.js';
import { makeOrder, makeTransaction } from '../../helpers/domain.js';

describe('missingPurchasesCheck', () => {
  it('returns UNKNOWN when transaction mapping is unresolved', () => {
    const finding = missingPurchasesCheck.run(
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

    expect(finding.checkId).toBe('MISSING_PURCHASES');
    expect(finding.status).toBe('UNKNOWN');
    expect(finding.confidence).toBe('LOW');
    expect(finding.evidence).toEqual([
      {
        type: 'TRANSACTION_MAPPING_RESULT',
        description:
          'Transaction mapping required to identify missing purchases.',
        data: {
          mappingStatus: 'UNRESOLVED',
          mappingConfidence: 'LOW',
          matchedCount: 0,
        },
      },
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it.each([
    ['AMBIGUOUS', 'UNKNOWN'],
    ['INSUFFICIENT_DATA', 'INSUFFICIENT_DATA'],
  ] as const)('returns %s mapping as %s', (mappingStatus, expectedStatus) => {
    const finding = missingPurchasesCheck.run(
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
    expect(finding.evidence.length).toBeGreaterThan(0);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('passes when every source order has a mapped GA4 purchase', () => {
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

    const finding = missingPurchasesCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.checkId).toBe('MISSING_PURCHASES');
    expect(finding.status).toBe('PASS');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      orderCount: 5,
      matchedCount: 5,
      missingCount: 0,
    });
    expect(finding.evidence).toEqual([]);
  });

  it('fails with evidence for a specific source order missing from GA4', () => {
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

    const finding = missingPurchasesCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('FAIL');
    expect(finding.confidence).toBe('MEDIUM');
    expect(finding.metrics).toEqual({
      orderCount: 5,
      matchedCount: 4,
      missingCount: 1,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'MISSING_PURCHASE',
        description:
          'Source order has no deterministically mapped GA4 purchase transaction.',
        data: {
          orderId: 'order-4',
          legacyResourceId: 'legacy-4',
        },
      },
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });
});
