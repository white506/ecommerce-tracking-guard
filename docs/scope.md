# E-commerce Tracking Guard — MVP Scope

## In scope

The MVP audits ecommerce transaction measurement between:

- Shopify
- Google Analytics 4

The primary unit of analysis is the transaction/order.

The MVP includes:

- Shopify transaction ingestion
- GA4 purchase data ingestion through the GA4 Data API
- canonical normalization
- transaction matching/resolution
- deterministic audit rules
- evidence-backed findings
- audit status and summary
- transaction-level inspection
- minimum persistence required by the product
- minimum UI required to connect sources, run an audit, and inspect results
- operational reliability required for an MVP

## Hard out of scope

Until Gate #4, do not add:

- Meta Ads
- Google Ads
- GTM
- WooCommerce
- BigQuery
- realtime monitoring
- scheduled monitoring
- Slack alerts
- email alerts
- AI diagnosis
- AI chat
- anomaly detection
- health score
- PDF reports
- white label
- mobile app
- SSO
- complex RBAC
- public API
- customer webhooks
- custom dashboards

Also not a priority before private validation:

- Stripe
- complex billing
- team invitations
- onboarding tours
- marketing automation
- admin dashboard

## Product boundary

The MVP is not intended to answer:

> Is every analytics event on this website implemented correctly?

It is intended to answer:

> Do Shopify and GA4 agree sufficiently at the ecommerce transaction level for the merchant to trust purchase measurement?

## Decision rule

A new feature or integration is not added because it is technically attractive or potentially useful.

Expansion requires evidence that the current constrained MVP cannot validate or deliver the core customer outcome without it.

## Current build order

1. M0 — Foundation
2. M1 — Domain Core
3. Gate #1 — Synthetic Truth
4. M2 — Real Data Adapters
5. Gate #2 — Real Truth
6. M3 — Persistence & Worker
7. M4 — OAuth / Integrations
8. Gate #3 — End-to-End
9. M5 — Product UI
10. M6 — Private Validation
11. Gate #4 — Private Validation decision

Until Gate #1 passes, implementation must remain focused on the domain engine and synthetic evidence.
