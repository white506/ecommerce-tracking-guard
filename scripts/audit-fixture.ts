import { runAudit } from '../src/domain/audit/engine.js';
import { AUDIT_POLICY_V1 } from '../src/domain/audit/policy.js';
import { RESOLVER_POLICY_V1 } from '../src/domain/resolver/policy.js';
import { resolveTransactions } from '../src/domain/resolver/resolver.js';
import {
  findGoldenAuditFixture,
  goldenAuditFixtures,
} from '../tests/fixtures/audit/index.js';

const fixtureName = process.argv[2];

if (fixtureName === undefined) {
  console.error(
    `Usage: pnpm audit:fixture <fixture>\nAvailable: ${goldenAuditFixtures
      .map((fixture) => fixture.name)
      .join(', ')}`,
  );
  process.exit(1);
}

const fixture = findGoldenAuditFixture(fixtureName);

if (fixture === undefined) {
  console.error(
    `Unknown fixture: ${fixtureName}\nAvailable: ${goldenAuditFixtures
      .map((item) => item.name)
      .join(', ')}`,
  );
  process.exit(1);
}

const mapping = resolveTransactions(
  fixture.orders,
  fixture.transactions,
  RESOLVER_POLICY_V1,
);

const findings = runAudit(
  {
    orders: fixture.orders,
    transactions: fixture.transactions,
    refunds: fixture.refunds,
    mapping,
  },
  AUDIT_POLICY_V1,
);

const report = {
  fixture: fixture.name,
  mapping: {
    status: mapping.status,
    confidence: mapping.confidence,
    matchCount: mapping.matches.length,
    candidateCount: mapping.candidates.length,
    matches: mapping.matches.map((match) => ({
      orderId: match.order.id,
      transactionId: match.transaction.transactionId,
      strategy: match.strategy,
      confidence: match.confidence,
    })),
  },
  findings,
};

console.log(JSON.stringify(report, null, 2));
