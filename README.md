# E-commerce Tracking Guard

Evidence-based Shopify ↔ GA4 ecommerce measurement audit.

## Status

BUILD CONSTRAINED MVP.

Current milestone: **M0 — Foundation**.
Next milestone: **M1 — Domain Core → Gate #1 Synthetic Truth**.

The MVP focuses on deterministic transaction-level reconciliation between Shopify and GA4. The primary question is whether purchase/revenue measurement in GA4 can be trusted against Shopify commerce data.

See:

- `docs/product-spec.md` — frozen product and engineering specification
- `docs/scope.md` — constrained MVP scope and exclusions

## Development

Requirements:

- Node.js 20.19.x
- pnpm 10.18.3
- Docker with Docker Compose

Install dependencies:

    pnpm install

Run quality checks:

    pnpm test
    pnpm typecheck
    pnpm lint
    pnpm format:check

Start local PostgreSQL:

    pnpm db:up

Stop local PostgreSQL:

    pnpm db:down

Local PostgreSQL is exposed on host port `55432` to avoid conflicts with other development projects.
