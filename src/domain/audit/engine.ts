import { currencyIntegrityCheck } from './checks/currency-integrity.js';
import { itemIdentityIntegrityCheck } from './checks/item-identity-integrity.js';
import { itemPresenceCheck } from './checks/item-presence.js';
import { missingPurchasesCheck } from './checks/missing-purchases.js';
import { orphanGa4TransactionsCheck } from './checks/orphan-ga4-transactions.js';
import { purchaseCoverageCheck } from './checks/purchase-coverage.js';
import { refundCoverageCheck } from './checks/refund-coverage.js';
import { transactionIdIntegrityCheck } from './checks/transaction-id-integrity.js';
import { transactionMappingCheck } from './checks/transaction-mapping.js';
import { transactionValueIntegrityCheck } from './checks/transaction-value-integrity.js';
import type { AuditCheck } from './check.js';
import type { AuditContext, Finding } from './models.js';
import type { AuditPolicy } from './policy.js';

const AUDIT_CHECKS: readonly AuditCheck[] = [
  transactionMappingCheck,
  purchaseCoverageCheck,
  missingPurchasesCheck,
  orphanGa4TransactionsCheck,
  transactionValueIntegrityCheck,
  currencyIntegrityCheck,
  transactionIdIntegrityCheck,
  itemPresenceCheck,
  itemIdentityIntegrityCheck,
  refundCoverageCheck,
];

export function runAudit(
  context: AuditContext,
  policy: AuditPolicy,
): readonly Finding[] {
  return AUDIT_CHECKS.map((check) => check.run(context, policy));
}
