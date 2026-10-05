import { describe, expect, it } from 'vitest';

import { RESOLVER_POLICY_V1 } from '../../src/domain/resolver/policy.js';
import { resolveTransactions } from '../../src/domain/resolver/resolver.js';
import { makeOrder, makeTransaction } from '../helpers/domain.js';

describe('resolveTransactions', () => {
  it('resolves a proven legacy resource id mapping', () => {
    const orders = [
      makeOrder('1001', '9001'),
      makeOrder('1002', '9002'),
      makeOrder('1003', '9003'),
      makeOrder('1004', '9004'),
      makeOrder('1005', '9005'),
    ];

    const transactions = [
      makeTransaction('9001'),
      makeTransaction('9002'),
      makeTransaction('9003'),
      makeTransaction('9004'),
      makeTransaction('9005'),
    ];

    const result = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(result.status).toBe('RESOLVED');
    expect(result.confidence).toBe('HIGH');
    expect(result.matches).toHaveLength(5);

    expect(
      result.matches.every((match) => match.strategy === 'LEGACY_RESOURCE_ID'),
    ).toBe(true);
  });

  it('returns insufficient data when the sample is too small', () => {
    const orders = [
      makeOrder('1001', '9001'),
      makeOrder('1002', '9002'),
      makeOrder('1003', '9003'),
      makeOrder('1004', '9004'),
    ];

    const transactions = [
      makeTransaction('9001'),
      makeTransaction('9002'),
      makeTransaction('9003'),
      makeTransaction('9004'),
    ];

    const result = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.confidence).toBe('LOW');
    expect(result.matches).toEqual([]);
    expect(result.candidates).toEqual([]);
  });

  it('returns ambiguous when an identifier maps multiple orders to one transaction', () => {
    const orders = [
      makeOrder('1001', '9001'),
      makeOrder('1002', '9001'),
      makeOrder('1003', '9003'),
      makeOrder('1004', '9004'),
      makeOrder('1005', '9005'),
    ];

    const transactions = [
      makeTransaction('9001'),
      makeTransaction('9002'),
      makeTransaction('9003'),
      makeTransaction('9004'),
      makeTransaction('9005'),
    ];

    const result = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(result.status).toBe('AMBIGUOUS');
    expect(result.confidence).toBe('LOW');
    expect(result.matches).toEqual([]);
  });

  it('returns ambiguous when GA4 contains duplicate transaction ids', () => {
    const orders = [
      makeOrder('1001', '9001'),
      makeOrder('1002', '9002'),
      makeOrder('1003', '9003'),
      makeOrder('1004', '9004'),
      makeOrder('1005', '9005'),
    ];

    const transactions = [
      makeTransaction('9001'),
      makeTransaction('9001'),
      makeTransaction('9002'),
      makeTransaction('9003'),
      makeTransaction('9004'),
      makeTransaction('9005'),
    ];

    const result = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(result.status).toBe('AMBIGUOUS');
    expect(result.confidence).toBe('LOW');
    expect(result.matches).toEqual([]);
  });

  it('resolves using the order name strategy', () => {
    const orders = [
      makeOrder('1001', '9001'),
      makeOrder('1002', '9002'),
      makeOrder('1003', '9003'),
      makeOrder('1004', '9004'),
      makeOrder('1005', '9005'),
    ];

    const transactions = [
      makeTransaction('#1001'),
      makeTransaction('#1002'),
      makeTransaction('#1003'),
      makeTransaction('#1004'),
      makeTransaction('#1005'),
    ];

    const result = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(result.status).toBe('RESOLVED');
    expect(result.confidence).toBe('HIGH');
    expect(result.matches).toHaveLength(5);

    expect(
      result.matches.every((match) => match.strategy === 'ORDER_NAME'),
    ).toBe(true);
  });

  it('returns ambiguous when equally strong strategies disagree', () => {
    const baseOrders = [
      makeOrder('1001', '9001'),
      makeOrder('1002', '9002'),
      makeOrder('1003', '9003'),
      makeOrder('1004', '9004'),
      makeOrder('1005', '9005'),
    ];

    const orders = baseOrders.map((order, index) => ({
      ...order,
      identifiers: {
        ...order.identifiers,
        name: String(9005 - index),
      },
    }));

    const transactions = [
      makeTransaction('9001'),
      makeTransaction('9002'),
      makeTransaction('9003'),
      makeTransaction('9004'),
      makeTransaction('9005'),
    ];

    const result = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(result.status).toBe('AMBIGUOUS');
    expect(result.confidence).toBe('LOW');
    expect(result.matches).toEqual([]);
  });

  it('resolves when equally strong strategies agree', () => {
    const baseOrders = [
      makeOrder('1001', '9001'),
      makeOrder('1002', '9002'),
      makeOrder('1003', '9003'),
      makeOrder('1004', '9004'),
      makeOrder('1005', '9005'),
    ];

    const orders = baseOrders.map((order) => ({
      ...order,
      identifiers: {
        ...order.identifiers,
        name: order.identifiers.legacyResourceId,
      },
    }));

    const transactions = [
      makeTransaction('9001'),
      makeTransaction('9002'),
      makeTransaction('9003'),
      makeTransaction('9004'),
      makeTransaction('9005'),
    ];

    const result = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(result.status).toBe('RESOLVED');
    expect(result.confidence).toBe('HIGH');
    expect(result.matches).toHaveLength(5);
  });

  it('resolves using order name without hash transformation', () => {
    const orders = [
      makeOrder('1001', 'legacy-1'),
      makeOrder('1002', 'legacy-2'),
      makeOrder('1003', 'legacy-3'),
      makeOrder('1004', 'legacy-4'),
      makeOrder('1005', 'legacy-5'),
    ];

    const transactions = [
      makeTransaction('1001'),
      makeTransaction('1002'),
      makeTransaction('1003'),
      makeTransaction('1004'),
      makeTransaction('1005'),
    ];

    const result = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(result.status).toBe('RESOLVED');
    expect(result.confidence).toBe('HIGH');
    expect(result.matches).toHaveLength(5);

    expect(
      result.matches.every(
        (match) => match.strategy === 'ORDER_NAME_WITHOUT_HASH',
      ),
    ).toBe(true);
  });

  it('resolves using the order number strategy', () => {
    const baseOrders = [
      makeOrder('1001', 'legacy-1'),
      makeOrder('1002', 'legacy-2'),
      makeOrder('1003', 'legacy-3'),
      makeOrder('1004', 'legacy-4'),
      makeOrder('1005', 'legacy-5'),
    ];

    const orders = baseOrders.map((order) => ({
      ...order,
      identifiers: {
        ...order.identifiers,
        name: `#name-${order.id}`,
      },
    }));

    const transactions = [
      makeTransaction('1001'),
      makeTransaction('1002'),
      makeTransaction('1003'),
      makeTransaction('1004'),
      makeTransaction('1005'),
    ];

    const result = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(result.status).toBe('RESOLVED');
    expect(result.confidence).toBe('HIGH');
    expect(result.matches).toHaveLength(5);

    expect(
      result.matches.every((match) => match.strategy === 'ORDER_NUMBER'),
    ).toBe(true);
  });

  it('resolves using the confirmation number strategy', () => {
    const baseOrders = [
      makeOrder('1001', 'legacy-1'),
      makeOrder('1002', 'legacy-2'),
      makeOrder('1003', 'legacy-3'),
      makeOrder('1004', 'legacy-4'),
      makeOrder('1005', 'legacy-5'),
    ];

    const orders = baseOrders.map((order, index) => ({
      ...order,
      identifiers: {
        ...order.identifiers,
        name: `#name-${order.id}`,
        orderNumber: `order-${order.id}`,
        confirmationNumber: `CONF-${index + 1}`,
      },
    }));

    const transactions = [
      makeTransaction('CONF-1'),
      makeTransaction('CONF-2'),
      makeTransaction('CONF-3'),
      makeTransaction('CONF-4'),
      makeTransaction('CONF-5'),
    ];

    const result = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(result.status).toBe('RESOLVED');
    expect(result.confidence).toBe('HIGH');
    expect(result.matches).toHaveLength(5);

    expect(
      result.matches.every((match) => match.strategy === 'CONFIRMATION_NUMBER'),
    ).toBe(true);
  });

  it('resolves with medium confidence at medium coverage threshold', () => {
    const orders = [
      makeOrder('1001', '9001'),
      makeOrder('1002', '9002'),
      makeOrder('1003', '9003'),
      makeOrder('1004', '9004'),
      makeOrder('1005', '9005'),
    ];

    const transactions = [
      makeTransaction('9001'),
      makeTransaction('9002'),
      makeTransaction('9003'),
      makeTransaction('9004'),
      makeTransaction('orphan'),
    ];

    const result = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(result.status).toBe('RESOLVED');
    expect(result.confidence).toBe('MEDIUM');
    expect(result.matches).toHaveLength(4);

    expect(result.matches.every((match) => match.confidence === 'MEDIUM')).toBe(
      true,
    );
  });

  it('returns ambiguous when any equally strong strategy disagrees', () => {
    const baseOrders = [
      makeOrder('1001', 'A1'),
      makeOrder('1002', 'A2'),
      makeOrder('1003', 'A3'),
      makeOrder('1004', 'A4'),
      makeOrder('1005', 'A5'),
    ];

    const orders = baseOrders.map((order, index) => ({
      ...order,
      identifiers: {
        ...order.identifiers,
        name: `A${index + 1}`,
        orderNumber: `B${index + 1}`,
      },
    }));

    const transactions = [
      ...[1, 2, 3, 4, 5].map((n) => makeTransaction(`A${n}`)),
      ...[1, 2, 3, 4, 5].map((n) => makeTransaction(`B${n}`)),
    ];

    const result = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(result.status).toBe('AMBIGUOUS');
    expect(result.confidence).toBe('LOW');
    expect(result.matches).toHaveLength(0);
  });

  it('returns unresolved below the medium coverage threshold', () => {
    const orders = [
      makeOrder('1001', '9001'),
      makeOrder('1002', '9002'),
      makeOrder('1003', '9003'),
      makeOrder('1004', '9004'),
      makeOrder('1005', '9005'),
    ];

    const transactions = [
      makeTransaction('9001'),
      makeTransaction('9002'),
      makeTransaction('9003'),
      makeTransaction('orphan-1'),
      makeTransaction('orphan-2'),
    ];

    const result = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(result.status).toBe('UNRESOLVED');
    expect(result.confidence).toBe('LOW');
    expect(result.matches).toHaveLength(0);
    expect(result.candidates).toHaveLength(0);
  });

  it('resolves when a conflicting strategy is outside the coverage gap', () => {
    const baseOrders = [
      makeOrder('1001', 'A1'),
      makeOrder('1002', 'A2'),
      makeOrder('1003', 'A3'),
      makeOrder('1004', 'A4'),
      makeOrder('1005', 'A5'),
    ];

    const orders = baseOrders.map((order, index) => ({
      ...order,
      identifiers: {
        ...order.identifiers,
        name: index < 4 ? `B${index + 1}` : null,
        orderNumber: null,
      },
    }));

    const transactions = [
      ...[1, 2, 3, 4, 5].map((n) => makeTransaction(`A${n}`)),
      ...[1, 2, 3, 4].map((n) => makeTransaction(`B${n}`)),
    ];

    const result = resolveTransactions(
      orders,
      transactions,
      RESOLVER_POLICY_V1,
    );

    expect(result.status).toBe('RESOLVED');
    expect(result.confidence).toBe('HIGH');
    expect(result.matches).toHaveLength(5);

    expect(
      result.matches.every((match) => match.strategy === 'LEGACY_RESOURCE_ID'),
    ).toBe(true);
  });

  it('resolves when coverage gap equals the minimum gap', () => {
    const baseOrders = [
      makeOrder('1001', 'A1'),
      makeOrder('1002', 'A2'),
      makeOrder('1003', 'A3'),
      makeOrder('1004', 'A4'),
      makeOrder('1005', 'A5'),
    ];

    const orders = baseOrders.map((order, index) => ({
      ...order,
      identifiers: {
        ...order.identifiers,
        name: index < 4 ? `B${index + 1}` : null,
        orderNumber: null,
      },
    }));

    const transactions = [
      ...[1, 2, 3, 4, 5].map((n) => makeTransaction(`A${n}`)),
      ...[1, 2, 3, 4].map((n) => makeTransaction(`B${n}`)),
    ];

    const result = resolveTransactions(orders, transactions, {
      ...RESOLVER_POLICY_V1,
      minimumCoverageGap: 0.2,
    });

    expect(result.status).toBe('RESOLVED');
    expect(result.confidence).toBe('HIGH');
    expect(result.matches).toHaveLength(5);
  });
});
