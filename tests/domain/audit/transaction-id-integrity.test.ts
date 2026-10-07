import { describe, expect, it } from 'vitest';

import { transactionIdIntegrityCheck } from '../../../src/domain/audit/checks/transaction-id-integrity.js';
import { AUDIT_POLICY_V1 } from '../../../src/domain/audit/policy.js';
import { RESOLVER_POLICY_V1 } from '../../../src/domain/resolver/policy.js';
import { resolveTransactions } from '../../../src/domain/resolver/resolver.js';
import { makeOrder, makeTransaction } from '../../helpers/domain.js';

describe('transactionIdIntegrityCheck', () => {
  it('passes when transaction ids agree with the resolved mapping strategy', () => {
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

    const finding = transactionIdIntegrityCheck.run(
      { orders, transactions, refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(mapping.status).toBe('RESOLVED');
    expect(finding.status).toBe('PASS');
    expect(finding.severity).toBe('INFO');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedCount: 5,
      validCount: 5,
      invalidCount: 0,
    });
    expect(finding.evidence).toEqual([]);
  });

  it.each([
    ['ORDER_NAME', '#1001'],
    ['ORDER_NAME_WITHOUT_HASH', '1001'],
    ['ORDER_NUMBER', '1001'],
    ['CONFIRMATION_NUMBER', 'CONF-1001'],
  ] as const)(
    'accepts %s when the transaction id matches that strategy',
    (strategy, transactionId) => {
      const order = makeOrder('1001', 'legacy-1');

      const mapping = {
        status: 'RESOLVED' as const,
        confidence: 'HIGH' as const,
        matches: [
          {
            order: {
              ...order,
              identifiers: {
                ...order.identifiers,
                name: '#1001',
                orderNumber: '1001',
                confirmationNumber: 'CONF-1001',
              },
            },
            transaction: makeTransaction(transactionId),
            strategy,
            confidence: 'HIGH' as const,
          },
        ],
        candidates: [],
      };

      const finding = transactionIdIntegrityCheck.run(
        { orders: [order], transactions: [], refunds: [], mapping },
        AUDIT_POLICY_V1,
      );

      expect(finding.status).toBe('PASS');
      expect(finding.metrics).toEqual({
        matchedCount: 1,
        validCount: 1,
        invalidCount: 0,
      });
    },
  );

  it('fails when a mapped transaction id contradicts its resolved strategy', () => {
    const order = makeOrder('order-1', 'legacy-1');
    const transaction = makeTransaction('wrong-id');

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

    const finding = transactionIdIntegrityCheck.run(
      { orders: [order], transactions: [transaction], refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('FAIL');
    expect(finding.severity).toBe('WARNING');
    expect(finding.confidence).toBe('HIGH');
    expect(finding.metrics).toEqual({
      matchedCount: 1,
      validCount: 0,
      invalidCount: 1,
      affectedCount: 1,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'TRANSACTION_ID_MISMATCH',
        description:
          'GA4 transaction id does not agree with the resolved mapping strategy.',
        data: {
          orderId: 'order-1',
          strategy: 'LEGACY_RESOURCE_ID',
          expectedTransactionId: 'legacy-1',
          observedTransactionId: 'wrong-id',
          comparisonBasis: 'RESOLVED_MAPPING_STRATEGY',
          affectedCount: 1,
        },
      },
    ]);
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

    const finding = transactionIdIntegrityCheck.run(
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
          'Resolved transaction mapping is required to validate transaction identifiers.',
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

  it('returns unknown when the resolved strategy identifier is unavailable', () => {
    const order = makeOrder('order-1', 'legacy-1');
    const transaction = makeTransaction('CONF-1');

    const mapping = {
      status: 'RESOLVED' as const,
      confidence: 'HIGH' as const,
      matches: [
        {
          order,
          transaction,
          strategy: 'CONFIRMATION_NUMBER' as const,
          confidence: 'HIGH' as const,
        },
      ],
      candidates: [],
    };

    const finding = transactionIdIntegrityCheck.run(
      { orders: [order], transactions: [transaction], refunds: [], mapping },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('UNKNOWN');
    expect(finding.severity).toBe('WARNING');
    expect(finding.metrics).toEqual({
      matchedCount: 1,
      validCount: 0,
      unassessableCount: 1,
      affectedCount: 1,
    });
    expect(finding.evidence).toEqual([
      {
        type: 'MISSING_EXPECTED_TRANSACTION_ID',
        description:
          'The source identifier required by the resolved mapping strategy is unavailable.',
        data: {
          orderId: 'order-1',
          strategy: 'CONFIRMATION_NUMBER',
          expectedTransactionId: null,
          observedTransactionId: 'CONF-1',
          comparisonBasis: 'RESOLVED_MAPPING_STRATEGY',
          affectedCount: 1,
        },
      },
    ]);
    expect(finding.limitations.length).toBeGreaterThan(0);
  });

  it('keeps fail when a proven mismatch exists alongside an unassessable match', () => {
    const mismatchedOrder = makeOrder('order-1', 'legacy-1');
    const unassessableOrder = makeOrder('order-2', 'legacy-2');

    const mismatchedTransaction = makeTransaction('wrong-id');
    const unassessableTransaction = makeTransaction('CONF-2');

    const mapping = {
      status: 'RESOLVED' as const,
      confidence: 'HIGH' as const,
      matches: [
        {
          order: mismatchedOrder,
          transaction: mismatchedTransaction,
          strategy: 'LEGACY_RESOURCE_ID' as const,
          confidence: 'HIGH' as const,
        },
        {
          order: unassessableOrder,
          transaction: unassessableTransaction,
          strategy: 'CONFIRMATION_NUMBER' as const,
          confidence: 'HIGH' as const,
        },
      ],
      candidates: [],
    };

    const finding = transactionIdIntegrityCheck.run(
      {
        orders: [mismatchedOrder, unassessableOrder],
        transactions: [mismatchedTransaction, unassessableTransaction],
        refunds: [],
        mapping,
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('FAIL');
    expect(finding.severity).toBe('WARNING');
    expect(finding.metrics).toEqual({
      matchedCount: 2,
      validCount: 0,
      invalidCount: 1,
      unassessableCount: 1,
      affectedCount: 1,
    });
    expect(finding.evidence).toHaveLength(1);
    expect(finding.evidence[0]?.type).toBe('TRANSACTION_ID_MISMATCH');
    expect(finding.limitations.length).toBeGreaterThan(0);
  });
});
