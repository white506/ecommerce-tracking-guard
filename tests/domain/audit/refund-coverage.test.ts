import { describe, expect, it } from 'vitest';

import { refundCoverageCheck } from '../../../src/domain/audit/checks/refund-coverage.js';
import { AUDIT_POLICY_V1 } from '../../../src/domain/audit/policy.js';
import { createMoney } from '../../../src/domain/money/money.js';
import {
  makeOrder,
  makeRefund,
  makeTransaction,
} from '../../helpers/domain.js';

function sourceRefund(id: string) {
  return {
    id,
    createdAt: '2026-10-02T00:00:00.000Z',
    amount: createMoney(1000n, 'USD'),
    items: [],
  };
}

describe('refundCoverageCheck', () => {
  it('returns NOT_APPLICABLE when source has no refunds', () => {
    const order = makeOrder('1001', 'gid-1001');
    const transaction = makeTransaction('gid-1001');

    const finding = refundCoverageCheck.run(
      {
        orders: [order],
        transactions: [transaction],
        refunds: [],
        mapping: {
          status: 'RESOLVED',
          confidence: 'HIGH',
          matches: [
            {
              order,
              transaction,
              strategy: 'LEGACY_RESOURCE_ID',
              confidence: 'HIGH',
            },
          ],
          candidates: [],
        },
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('NOT_APPLICABLE');
  });

  it('fails when a mapped refunded order has no GA4 refund', () => {
    const baseOrder = makeOrder('1001', 'gid-1001');
    const order = { ...baseOrder, refunds: [sourceRefund('refund-1')] };
    const transaction = makeTransaction('gid-1001');

    const finding = refundCoverageCheck.run(
      {
        orders: [order],
        transactions: [transaction],
        refunds: [],
        mapping: {
          status: 'RESOLVED',
          confidence: 'HIGH',
          matches: [
            {
              order,
              transaction,
              strategy: 'LEGACY_RESOURCE_ID',
              confidence: 'HIGH',
            },
          ],
          candidates: [],
        },
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('FAIL');
    expect(finding.metrics.affectedCount).toBe(1);
  });

  it('passes when one source refund has a GA4 refund for the mapped transaction', () => {
    const baseOrder = makeOrder('1001', 'gid-1001');
    const order = { ...baseOrder, refunds: [sourceRefund('refund-1')] };
    const transaction = makeTransaction('gid-1001');

    const finding = refundCoverageCheck.run(
      {
        orders: [order],
        transactions: [transaction],
        refunds: [makeRefund('gid-1001')],
        mapping: {
          status: 'RESOLVED',
          confidence: 'HIGH',
          matches: [
            {
              order,
              transaction,
              strategy: 'LEGACY_RESOURCE_ID',
              confidence: 'HIGH',
            },
          ],
          candidates: [],
        },
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('PASS');
  });

  it('returns UNKNOWN when a refunded order has no resolved purchase match', () => {
    const baseOrder = makeOrder('1001', 'gid-1001');
    const order = { ...baseOrder, refunds: [sourceRefund('refund-1')] };

    const finding = refundCoverageCheck.run(
      {
        orders: [order],
        transactions: [],
        refunds: [],
        mapping: {
          status: 'RESOLVED',
          confidence: 'HIGH',
          matches: [],
          candidates: [],
        },
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('UNKNOWN');
    expect(finding.metrics.affectedCount).toBe(1);
  });

  it('keeps FAIL when one refunded order is missing and another is unmapped', () => {
    const baseOrder1 = makeOrder('1001', 'gid-1001');
    const baseOrder2 = makeOrder('1002', 'gid-1002');

    const order1 = { ...baseOrder1, refunds: [sourceRefund('refund-1')] };
    const order2 = { ...baseOrder2, refunds: [sourceRefund('refund-2')] };
    const transaction1 = makeTransaction('gid-1001');

    const finding = refundCoverageCheck.run(
      {
        orders: [order1, order2],
        transactions: [transaction1],
        refunds: [],
        mapping: {
          status: 'RESOLVED',
          confidence: 'HIGH',
          matches: [
            {
              order: order1,
              transaction: transaction1,
              strategy: 'LEGACY_RESOURCE_ID',
              confidence: 'HIGH',
            },
          ],
          candidates: [],
        },
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('FAIL');
    expect(finding.metrics.missingRefundedOrderCount).toBe(1);
    expect(finding.metrics.affectedCount).toBe(1);
  });

  it('returns UNKNOWN when multiple source refunds cannot be proven covered individually', () => {
    const baseOrder = makeOrder('1001', 'gid-1001');
    const order = {
      ...baseOrder,
      refunds: [sourceRefund('refund-1'), sourceRefund('refund-2')],
    };
    const transaction = makeTransaction('gid-1001');

    const finding = refundCoverageCheck.run(
      {
        orders: [order],
        transactions: [transaction],
        refunds: [makeRefund('gid-1001')],
        mapping: {
          status: 'RESOLVED',
          confidence: 'HIGH',
          matches: [
            {
              order,
              transaction,
              strategy: 'LEGACY_RESOURCE_ID',
              confidence: 'HIGH',
            },
          ],
          candidates: [],
        },
      },
      AUDIT_POLICY_V1,
    );

    expect(finding.status).toBe('UNKNOWN');
    expect(finding.metrics.affectedCount).toBe(1);
  });

  it.each([
    ['UNRESOLVED', 'UNKNOWN'],
    ['AMBIGUOUS', 'UNKNOWN'],
    ['INSUFFICIENT_DATA', 'INSUFFICIENT_DATA'],
  ] as const)(
    'returns %s mapping as %s refund coverage',
    (mappingStatus, expectedStatus) => {
      const baseOrder = makeOrder('1001', 'gid-1001');
      const order = {
        ...baseOrder,
        refunds: [sourceRefund('refund-1')],
      };

      const finding = refundCoverageCheck.run(
        {
          orders: [order],
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
      expect(finding.metrics.affectedCount).toBe(1);
    },
  );
});
