# E-commerce Tracking Guard — Product Specification

## Status

Build-constrained MVP.

The product hypothesis and initial market research are complete enough to begin implementation.
Development must not expand the MVP without new evidence.

## Product goal

E-commerce Tracking Guard audits whether ecommerce transactions recorded by Shopify are represented correctly in GA4.

The product answers a narrow operational question:

> Can the merchant trust the ecommerce transaction data currently reaching GA4?

The MVP focuses on deterministic, evidence-based auditing rather than generic analytics monitoring.

## Core workflow

1. Connect a Shopify store.
2. Connect a GA4 property.
3. Import comparable transaction data.
4. Normalize both sources into canonical records.
5. Resolve Shopify orders against GA4 purchase events.
6. Run deterministic audit checks.
7. Classify findings.
8. Present evidence explaining every finding.
9. Allow the user to inspect affected transactions and recommended next steps.

## MVP wedge

The initial wedge is transaction-level Shopify ↔ GA4 ecommerce measurement auditing.

The system is not a general-purpose analytics observability platform.

## MVP integrations

Required:

- Shopify
- Google Analytics 4 Data API

Not required for MVP:

- BigQuery
- Google Tag Manager
- consent-management platforms
- advertising platforms
- additional ecommerce platforms

## Architecture

Use a modular monolith.

Primary stack:

- TypeScript with strict mode
- Next.js
- PostgreSQL
- Prisma
- Zod
- Vitest
- Playwright
- pnpm
- Docker Compose

Background work should initially run from the same codebase.

Do not introduce distributed infrastructure unless evidence requires it.

## Canonical pipeline

The audit pipeline is:

Source adapters
→ canonical normalization
→ transaction resolver
→ deterministic audit engine
→ findings/evidence
→ presentation

Source-specific representations must not leak into the audit engine.

## Deterministic audit principle

Audit conclusions are produced by explicit deterministic rules.

AI may later assist with explanation or remediation guidance, but it must not decide whether measurement is correct.

Given identical canonical input and the same audit policy version, the engine must produce identical results.

## Canonical domain

The canonical domain must contain at minimum:

- Money
- CanonicalOrder
- CanonicalOrderItem
- CanonicalRefund
- CanonicalRefundItem
- AnalyticsTransaction
- AnalyticsItem
- TransactionMappingCandidate
- TransactionMappingResult
- TransactionMatch
- AuditContext
- Finding
- Evidence

External API representations must be converted into canonical models before entering the resolver or Audit Engine.

The domain layer must not import:

- Next.js
- React
- Prisma
- Shopify SDK
- Google SDK

### Money

Financial reconciliation must not use JavaScript floating-point equality.

Conceptually:

```ts
type Money = {
  amountMinor: bigint;
  currency: string;
};
```

For example:
USD 123.45 → 12345 USD
Currency exponent must be handled explicitly because not every currency uses two decimal digits.
When Money is serialized to JSON, bigint values must be represented as strings.

## Transaction resolution

Transaction identity must be resolved explicitly and deterministically.

Do not assume:

`GA4 transaction_id === Shopify.id`

A Shopify implementation may send:

- legacyResourceId
- order name
- order name without `#`
- order number
- confirmation number
- another deterministic representation

The resolver tests known deterministic strategies.

Do not use fuzzy matching, Levenshtein distance, `contains`, or `startsWith` to manufacture a match.

Safe normalization and explicit identifier transformations are separate concepts.

The resolver must consider:

- coverage
- sample size
- collisions
- ambiguity
- best strategy versus second-best strategy

TransactionMappingResult states:

- RESOLVED
- AMBIGUOUS
- UNRESOLVED
- INSUFFICIENT_DATA

Mapping confidence:

- HIGH
- MEDIUM
- LOW

Thresholds must be centralized.

If mapping is not proven, downstream checks must be able to return UNKNOWN rather than incorrectly blaming GA4.

## Audit engine

Audit Engine v0 contains exactly ten core checks:

1. Transaction Mapping
2. Purchase Coverage
3. Missing Purchases
4. Unknown/Orphan GA4 Transactions
5. Transaction Value Integrity
6. Currency Integrity
7. Transaction ID Integrity
8. Item Presence
9. Item Identity Integrity
10. Refund Coverage

Do not expand v0 into a full ecommerce funnel audit.

The following are not part of Audit Engine v0:

- view_item
- add_to_cart
- begin_checkout
- select_item
- view_item_list
- wishlist
- full funnel conversion

The first version answers whether purchase/revenue measurement can be trusted.

## Audit states

Audit checks use exactly these states:

- PASS
- WARNING
- FAIL
- UNKNOWN
- INSUFFICIENT_DATA
- NOT_APPLICABLE

Absence of data does not automatically mean FAIL.

Severity and confidence are separate concepts.

Severity:

- INFO
- WARNING
- CRITICAL

Confidence:

- LOW
- MEDIUM
- HIGH

A Finding is a structured artifact containing:

- checkId
- status
- severity
- confidence
- title
- summary
- metrics
- evidence
- possibleCauses
- recommendations
- limitations

Every non-pass finding must provide:

- observed state
- expected or comparison basis
- affected count
- affected amount when applicable
- evidence
- confidence
- limitations

Do not create a synthetic Health Score in the MVP.

## Revenue comparison

Only equivalent financial concepts may be compared.

The canonical model must distinguish:

- item subtotal/revenue
- discounts
- shipping
- tax
- original total
- current total
- refunds

Refunds, cancellations, and order edits must not automatically be interpreted as purchase-tracking failures.

## Testing strategy

Domain correctness is the priority.

Golden fixtures must include at minimum:

1. `01-perfect`
2. `02-missing-purchases`
3. `03-revenue-mismatch`
4. `04-currency-errors`
5. `05-unresolved-mapping`
6. `06-ambiguous-mapping`
7. `07-missing-items`
8. `08-refunds`
9. `09-mixed-errors`
10. `10-small-sample`

Required executable harness:

`pnpm audit:fixture <fixture>`

Pipeline:

`fixture → canonical data → resolver → audit engine → JSON report`

The audit must be deterministic.

External APIs are not required for Gate #1.

## Milestone gates

### M0 — Foundation

- initialize repository
- TypeScript strict
- lint
- formatter
- Vitest
- PostgreSQL local environment
- CI
- `docs/product-spec.md`
- `docs/scope.md`

### M1 — Domain Core

Implement:

- Money
- canonical models
- analytics models
- transaction resolver
- AuditPolicyV1
- Audit Engine
- 10 checks
- golden fixtures
- CLI
- deterministic tests

Then STOP at Gate #1 — Synthetic Truth.

Verify that the deterministic engine correctly identifies predefined synthetic problems.

Do not build the SaaS shell before Gate #1 passes.

### M2 — Real Data Adapters

Implement:

- Shopify mapper
- Shopify fixtures
- GA4 mapper
- GA4 fixtures
- controlled real-data input

Then STOP at Gate #2 — Real Truth.

Validate real data manually, including:

- mapping
- missing transactions
- value mismatches
- refunds
- false positives

Precision is more important than quantity of findings.

### M3 — Persistence & Worker

Implement:

- PostgreSQL schema
- AuditRun
- snapshots
- findings
- DB-backed jobs
- worker
- retries/idempotency

### M4 — OAuth / Integrations

Implement:

- Shopify OAuth
- Google OAuth
- GA4 property selection
- encrypted credentials
- revocation
- minimal security hardening

Then STOP at Gate #3 — End-to-End.

Validate:

`Browser → Shopify OAuth → GA4 OAuth → Run audit → Worker → real APIs → engine → database → report`

### M5 — Product UI

Implement:

- clients
- integrations
- new audit
- progress
- report
- finding detail
- CSV evidence
- audit history
- re-run

### M6 — Private Validation

Run audits against several real Shopify/GA4 implementations.

Measure:

- mapping success
- true and false findings
- actionability
- usefulness
- re-run behavior
- second-client behavior

Then STOP at Gate #4 and decide:

- GO
- PIVOT
- KILL

Only after GO consider:

- Shopify App Review
- Google production verification
- landing
- billing
- public beta

## Engineering discipline

For each implementation slice:

1. inspect current repository state
2. make the smallest coherent change
3. run relevant tests
4. run typecheck
5. run lint/format checks
6. inspect the diff
7. commit only a coherent green state

Do not guess repository state.

Do not implement future milestones early.

```

```
