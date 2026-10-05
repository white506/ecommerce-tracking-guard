import type { AuditContext, Finding } from './models.js';
import type { AuditPolicy } from './policy.js';

export type AuditCheckId =
  | 'TRANSACTION_MAPPING'
  | 'PURCHASE_COVERAGE'
  | 'MISSING_PURCHASES'
  | 'ORPHAN_GA4_TRANSACTIONS'
  | 'TRANSACTION_VALUE_INTEGRITY'
  | 'CURRENCY_INTEGRITY'
  | 'TRANSACTION_ID_INTEGRITY'
  | 'ITEM_PRESENCE'
  | 'ITEM_IDENTITY_INTEGRITY'
  | 'REFUND_COVERAGE';

export type AuditCheck = Readonly<{
  id: AuditCheckId;
  run: (context: AuditContext, policy: AuditPolicy) => Finding;
}>;
