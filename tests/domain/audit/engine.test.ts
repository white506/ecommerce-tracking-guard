import { describe, expect, it } from 'vitest';

import { AUDIT_CHECK_IDS } from '../../../src/domain/audit/checks.js';
import { runAudit } from '../../../src/domain/audit/engine.js';
import { AUDIT_POLICY_V1 } from '../../../src/domain/audit/policy.js';
import { makeOrder, makeTransaction } from '../../helpers/domain.js';

describe('runAudit', () => {
  it('runs exactly the frozen audit checks in deterministic order', () => {
    const orders = Array.from({ length: 5 }, (_, index) =>
      makeOrder(`order-${index}`, `legacy-${index}`),
    );

    const transactions = Array.from({ length: 5 }, (_, index) =>
      makeTransaction(`legacy-${index}`),
    );

    const findings = runAudit(
      {
        orders,
        transactions,
        refunds: [],
        mapping: {
          status: 'RESOLVED',
          confidence: 'HIGH',
          matches: orders.map((order, index) => ({
            order,
            transaction: transactions[index]!,
            strategy: 'LEGACY_RESOURCE_ID',
            confidence: 'HIGH',
          })),
          candidates: [],
        },
      },
      AUDIT_POLICY_V1,
    );

    expect(findings).toHaveLength(10);
    expect(findings.map((finding) => finding.checkId)).toEqual(AUDIT_CHECK_IDS);
  });
});
