import { describe, expect, it } from 'vitest';

import { runAudit } from '../../../src/domain/audit/engine.js';
import { AUDIT_POLICY_V1 } from '../../../src/domain/audit/policy.js';
import { RESOLVER_POLICY_V1 } from '../../../src/domain/resolver/policy.js';
import { resolveTransactions } from '../../../src/domain/resolver/resolver.js';
import { goldenAuditFixtures } from './index.js';

describe('golden audit fixtures', () => {
  it.each(goldenAuditFixtures)(
    '$name matches the expected synthetic truth',
    (fixture) => {
      const mapping = resolveTransactions(
        fixture.orders,
        fixture.transactions,
        RESOLVER_POLICY_V1,
      );

      expect({
        status: mapping.status,
        confidence: mapping.confidence,
      }).toEqual(fixture.expectedMapping);

      const findings = runAudit(
        {
          orders: fixture.orders,
          transactions: fixture.transactions,
          refunds: fixture.refunds,
          mapping,
        },
        AUDIT_POLICY_V1,
      );

      expect(
        Object.fromEntries(
          findings.map((finding) => [finding.checkId, finding.status]),
        ),
      ).toEqual(fixture.expectedStatuses);
    },
  );
});

it('produces deterministic audit results for the same input', () => {
  const fixture = goldenAuditFixtures.find(
    (item) => item.name === '09-mixed-errors',
  );

  expect(fixture).toBeDefined();

  if (fixture === undefined) {
    throw new Error('09-mixed-errors fixture is missing');
  }

  const run = () => {
    const mapping = resolveTransactions(
      fixture.orders,
      fixture.transactions,
      RESOLVER_POLICY_V1,
    );

    return {
      mapping,
      findings: runAudit(
        {
          orders: fixture.orders,
          transactions: fixture.transactions,
          refunds: fixture.refunds,
          mapping,
        },
        AUDIT_POLICY_V1,
      ),
    };
  };

  expect(run()).toEqual(run());
});
