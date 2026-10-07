import type {
  AnalyticsRefund,
  AnalyticsTransaction,
} from '../../../src/domain/analytics/models.js';
import type { CanonicalOrder } from '../../../src/domain/commerce/models.js';
import type { AuditCheckId } from '../../../src/domain/audit/check.js';
import type { AuditStatus } from '../../../src/domain/audit/models.js';
import type {
  MappingConfidence,
  MappingStatus,
} from '../../../src/domain/resolver/models.js';

export type GoldenAuditFixture = Readonly<{
  name: string;
  orders: readonly CanonicalOrder[];
  transactions: readonly AnalyticsTransaction[];
  refunds: readonly AnalyticsRefund[];
  expectedMapping: Readonly<{
    status: MappingStatus;
    confidence: MappingConfidence;
  }>;
  expectedStatuses: Readonly<Record<AuditCheckId, AuditStatus>>;
}>;
