import type { MappingStrategy } from '../../resolver/models.js';
import type { AuditCheck } from '../check.js';

function expectedTransactionId(
  strategy: MappingStrategy,
  identifiers: {
    readonly legacyResourceId: string | null;
    readonly name: string | null;
    readonly orderNumber: string | null;
    readonly confirmationNumber: string | null;
  },
): string | null {
  switch (strategy) {
    case 'LEGACY_RESOURCE_ID':
      return identifiers.legacyResourceId;
    case 'ORDER_NAME':
      return identifiers.name;
    case 'ORDER_NAME_WITHOUT_HASH':
      return identifiers.name?.startsWith('#')
        ? identifiers.name.slice(1)
        : null;
    case 'ORDER_NUMBER':
      return identifiers.orderNumber;
    case 'CONFIRMATION_NUMBER':
      return identifiers.confirmationNumber;
  }
}

export const transactionIdIntegrityCheck: AuditCheck = {
  id: 'TRANSACTION_ID_INTEGRITY',

  run: (context) => {
    const { mapping } = context;

    if (mapping.status !== 'RESOLVED') {
      const status =
        mapping.status === 'INSUFFICIENT_DATA'
          ? 'INSUFFICIENT_DATA'
          : 'UNKNOWN';

      return {
        checkId: 'TRANSACTION_ID_INTEGRITY',
        status,
        severity: 'WARNING',
        confidence: mapping.confidence,
        title: 'Transaction identifier integrity cannot be determined',
        summary:
          'Transaction mapping is not resolved, so transaction identifiers cannot be validated reliably.',
        metrics: {
          matchedCount: mapping.matches.length,
        },
        evidence: [
          {
            type: 'TRANSACTION_MAPPING_RESULT',
            description:
              'Resolved transaction mapping is required to validate transaction identifiers.',
            data: {
              mappingStatus: mapping.status,
              mappingConfidence: mapping.confidence,
              matchedCount: mapping.matches.length,
            },
          },
        ],
        possibleCauses: [],
        recommendations: [],
        limitations: [
          'Transaction identifiers cannot be validated until transaction mapping is resolved.',
        ],
      };
    }

    const evaluatedMatches = mapping.matches.map((match) => ({
      match,
      expectedTransactionId: expectedTransactionId(
        match.strategy,
        match.order.identifiers,
      ),
    }));

    const validMatches = evaluatedMatches.filter(
      ({ match, expectedTransactionId }) =>
        expectedTransactionId !== null &&
        match.transaction.transactionId === expectedTransactionId,
    );

    const mismatchedMatches = evaluatedMatches.filter(
      ({ match, expectedTransactionId }) =>
        expectedTransactionId !== null &&
        match.transaction.transactionId !== expectedTransactionId,
    );

    const unassessableMatches = evaluatedMatches.filter(
      ({ expectedTransactionId }) => expectedTransactionId === null,
    );

    if (mismatchedMatches.length > 0) {
      return {
        checkId: 'TRANSACTION_ID_INTEGRITY',
        status: 'FAIL',
        severity: 'WARNING',
        confidence: mapping.confidence,
        title: 'Transaction identifier mismatches detected',
        summary:
          'Some mapped GA4 transaction identifiers contradict the resolved mapping strategy.',
        metrics: {
          matchedCount: mapping.matches.length,
          validCount: validMatches.length,
          invalidCount: mismatchedMatches.length,
          ...(unassessableMatches.length > 0
            ? { unassessableCount: unassessableMatches.length }
            : {}),
          affectedCount: mismatchedMatches.length,
        },
        evidence: mismatchedMatches.map(({ match, expectedTransactionId }) => ({
          type: 'TRANSACTION_ID_MISMATCH',
          description:
            'GA4 transaction id does not agree with the resolved mapping strategy.',
          data: {
            orderId: match.order.id,
            strategy: match.strategy,
            expectedTransactionId,
            observedTransactionId: match.transaction.transactionId,
          },
        })),
        possibleCauses: [],
        recommendations: [],
        limitations:
          unassessableMatches.length > 0
            ? [
                `${unassessableMatches.length} mapped transaction(s) could not be assessed because the required source identifier is unavailable.`,
              ]
            : [],
      };
    }

    if (unassessableMatches.length > 0) {
      return {
        checkId: 'TRANSACTION_ID_INTEGRITY',
        status: 'UNKNOWN',
        severity: 'WARNING',
        confidence: mapping.confidence,
        title: 'Some transaction identifiers cannot be validated',
        summary:
          'The source identifiers required by the resolved mapping strategy are unavailable for some transactions.',
        metrics: {
          matchedCount: mapping.matches.length,
          validCount: validMatches.length,
          unassessableCount: unassessableMatches.length,
          affectedCount: unassessableMatches.length,
        },
        evidence: unassessableMatches.map(
          ({ match, expectedTransactionId }) => ({
            type: 'MISSING_EXPECTED_TRANSACTION_ID',
            description:
              'The source identifier required by the resolved mapping strategy is unavailable.',
            data: {
              orderId: match.order.id,
              strategy: match.strategy,
              expectedTransactionId,
              observedTransactionId: match.transaction.transactionId,
            },
          }),
        ),
        possibleCauses: [],
        recommendations: [],
        limitations: [
          'Transaction identifier integrity cannot be fully determined when the required source identifier is unavailable.',
        ],
      };
    }

    return {
      checkId: 'TRANSACTION_ID_INTEGRITY',
      status: 'PASS',
      severity: 'INFO',
      confidence: mapping.confidence,
      title: 'Transaction identifiers are consistent',
      summary:
        'Mapped GA4 transaction identifiers agree with the resolved mapping strategy.',
      metrics: {
        matchedCount: mapping.matches.length,
        validCount: validMatches.length,
        invalidCount: mapping.matches.length - validMatches.length,
      },
      evidence: [],
      possibleCauses: [],
      recommendations: [],
      limitations: [],
    };
  },
};
