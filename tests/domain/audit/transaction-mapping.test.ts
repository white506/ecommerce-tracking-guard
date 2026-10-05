import { describe, expect, it } from 'vitest';

import { transactionMappingCheck } from '../../../src/domain/audit/checks/transaction-mapping.js';
import { AUDIT_POLICY_V1 } from '../../../src/domain/audit/policy.js';
import { RESOLVER_POLICY_V1 } from '../../../src/domain/resolver/policy.js';
import { resolveTransactions } from '../../../src/domain/resolver/resolver.js';
import { makeOrder, makeTransaction } from '../../helpers/domain.js';

describe('transactionMappingCheck', () => {
  it('passes when transaction mapping is resolved', () => {
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

    const finding = transactionMappingCheck.run(
      { orders, transactions, mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.checkId).toBe('TRANSACTION_MAPPING');
    expect(finding.status).toBe('PASS');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      orderCount: 5,
      transactionCount: 5,
      matchedCount: 5,
    });
  });

  it.each([
    ['UNRESOLVED', 'WARNING'],
    ['AMBIGUOUS', 'WARNING'],
    ['INSUFFICIENT_DATA', 'INSUFFICIENT_DATA'],
  ] as const)('returns %s mapping as %s', (mappingStatus, expectedStatus) => {
    const finding = transactionMappingCheck.run(
      {
        orders: [],
        transactions: [],
        mapping: {
          status: mappingStatus,
          confidence: 'LOW',
          matches: [],
          candidates: [],
        },
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.checkId).toBe('TRANSACTION_MAPPING');
    expect(finding.status).toBe(expectedStatus);
    expect(finding.confidence).toBe('LOW');
    expect(finding.metrics).toEqual({
      orderCount: 0,
      transactionCount: 0,
      matchedCount: 0,
    });
  });

  it('provides evidence and limitations when mapping is unresolved', () => {
    const finding = transactionMappingCheck.run(
      {
        orders: [],
        transactions: [],
        mapping: {
          status: 'UNRESOLVED',
          confidence: 'LOW',
          matches: [],
          candidates: [],
        },
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.evidence).toEqual([
      {
        type: 'TRANSACTION_MAPPING_RESULT',
        description: 'Deterministic transaction resolver result.',
        data: {
          mappingStatus: 'UNRESOLVED',
          mappingConfidence: 'LOW',
          orderCount: 0,
          transactionCount: 0,
          matchedCount: 0,
          candidateCount: 0,
        },
      },
    ]);

    expect(finding.limitations).toEqual([
      'Downstream transaction-level checks cannot reliably attribute GA4 transactions to source orders.',
    ]);
  });
});
