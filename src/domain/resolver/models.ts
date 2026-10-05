import type { AnalyticsTransaction } from '../analytics/models.js';
import type { CanonicalOrder } from '../commerce/models.js';

export type MappingStatus =
  'RESOLVED' | 'AMBIGUOUS' | 'UNRESOLVED' | 'INSUFFICIENT_DATA';

export type MappingConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type MappingStrategy =
  | 'LEGACY_RESOURCE_ID'
  | 'ORDER_NAME'
  | 'ORDER_NAME_WITHOUT_HASH'
  | 'ORDER_NUMBER'
  | 'CONFIRMATION_NUMBER';

export type TransactionMappingCandidate = Readonly<{
  orderId: string;
  transactionId: string;
  strategy: MappingStrategy;
  confidence: MappingConfidence;
}>;

export type TransactionMatch = Readonly<{
  order: CanonicalOrder;
  transaction: AnalyticsTransaction;
  strategy: MappingStrategy;
  confidence: MappingConfidence;
}>;

export type TransactionMappingResult = Readonly<{
  status: MappingStatus;
  confidence: MappingConfidence;
  matches: readonly TransactionMatch[];
  candidates: readonly TransactionMappingCandidate[];
}>;
