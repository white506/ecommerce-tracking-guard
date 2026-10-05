import type {
  AnalyticsRefund,
  AnalyticsTransaction,
} from '../analytics/models.js';
import type { CanonicalOrder } from '../commerce/models.js';
import type { TransactionMappingResult } from '../resolver/models.js';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type AuditStatus =
  | 'PASS'
  | 'WARNING'
  | 'FAIL'
  | 'UNKNOWN'
  | 'INSUFFICIENT_DATA'
  | 'NOT_APPLICABLE';

export type FindingSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type FindingConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export type Evidence = Readonly<{
  type: string;
  description: string;
  data: Readonly<Record<string, JsonValue>>;
}>;

export type Finding = Readonly<{
  checkId: string;
  status: AuditStatus;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  title: string;
  summary: string;
  metrics: Readonly<Record<string, JsonValue>>;
  evidence: readonly Evidence[];
  possibleCauses: readonly string[];
  recommendations: readonly string[];
  limitations: readonly string[];
}>;

export type AuditContext = Readonly<{
  orders: readonly CanonicalOrder[];
  transactions: readonly AnalyticsTransaction[];
  refunds: readonly AnalyticsRefund[];
  mapping: TransactionMappingResult;
}>;
