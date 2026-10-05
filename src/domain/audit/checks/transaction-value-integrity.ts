import type { AuditCheck } from '../check.js';

export const transactionValueIntegrityCheck: AuditCheck = {
  id: 'TRANSACTION_VALUE_INTEGRITY',

  run: (context, policy) => {
    const { mapping } = context;

    if (mapping.status === 'RESOLVED') {
      const missingValueMatches = [];
      const missingItemBasisMatches = [];
      const currencyMismatchMatches = [];
      const valueMismatches = [];
      let comparableCount = 0;

      for (const match of mapping.matches) {
        const transactionValue = match.transaction.value;

        if (transactionValue === null) {
          missingValueMatches.push(match);
          continue;
        }

        if (match.order.items.length === 0) {
          missingItemBasisMatches.push(match);
          continue;
        }

        const sameCurrency = match.order.items.every(
          (item) => item.total.currency === transactionValue.currency,
        );

        if (!sameCurrency) {
          currencyMismatchMatches.push(match);
          continue;
        }

        comparableCount += 1;

        const expectedAmountMinor = match.order.items.reduce(
          (sum, item) => sum + item.total.amountMinor,
          0n,
        );

        const difference =
          expectedAmountMinor >= transactionValue.amountMinor
            ? expectedAmountMinor - transactionValue.amountMinor
            : transactionValue.amountMinor - expectedAmountMinor;

        if (difference > policy.monetaryToleranceMinor) {
          valueMismatches.push({
            match,
            expectedAmountMinor,
            observedAmountMinor: transactionValue.amountMinor,
            differenceMinor: difference,
            currency: transactionValue.currency,
          });
        }
      }

      const unassessableCount =
        missingValueMatches.length +
        missingItemBasisMatches.length +
        currencyMismatchMatches.length;

      if (valueMismatches.length > 0) {
        return {
          checkId: 'TRANSACTION_VALUE_INTEGRITY',
          status: 'FAIL',
          severity: 'WARNING',
          confidence: mapping.confidence,
          title: 'Transaction value mismatches detected',
          summary:
            'Some comparable mapped GA4 purchase values differ from source item totals.',
          metrics: {
            matchedCount: mapping.matches.length,
            comparableCount,
            mismatchCount: valueMismatches.length,
            ...(unassessableCount > 0 ? { unassessableCount } : {}),
            affectedCount: valueMismatches.length,
          },
          evidence: [
            ...valueMismatches.map((mismatch) => ({
              type: 'TRANSACTION_VALUE_MISMATCH',
              description:
                'GA4 transaction value differs from the source item total.',
              data: {
                orderId: mismatch.match.order.id,
                transactionId: mismatch.match.transaction.transactionId,
                comparisonBasis: 'SUM_SOURCE_ITEM_TOTALS',
                expectedAmountMinor: mismatch.expectedAmountMinor.toString(),
                observedAmountMinor: mismatch.observedAmountMinor.toString(),
                differenceMinor: mismatch.differenceMinor.toString(),
                currency: mismatch.currency,
              },
            })),
            ...missingValueMatches.map((match) => ({
              type: 'MISSING_TRANSACTION_VALUE',
              description:
                'Mapped GA4 purchase transaction has no value available for comparison.',
              data: {
                orderId: match.order.id,
                transactionId: match.transaction.transactionId,
              },
            })),
            ...missingItemBasisMatches.map((match) => ({
              type: 'MISSING_ITEM_VALUE_BASIS',
              description:
                'Mapped source order has no item totals available for transaction value comparison.',
              data: {
                orderId: match.order.id,
                transactionId: match.transaction.transactionId,
              },
            })),
            ...currencyMismatchMatches.map((match) => ({
              type: 'INCOMPARABLE_TRANSACTION_CURRENCY',
              description:
                'GA4 transaction value and source item totals use different currencies.',
              data: {
                orderId: match.order.id,
                transactionId: match.transaction.transactionId,
                sourceCurrency: match.order.items[0]?.total.currency ?? null,
                observedCurrency: match.transaction.value?.currency ?? null,
              },
            })),
          ],
          possibleCauses: [],
          recommendations: [],
          limitations:
            unassessableCount > 0
              ? [
                  `${unassessableCount} mapped transaction(s) could not be assessed for value integrity.`,
                ]
              : [],
        };
      }

      if (unassessableCount > 0) {
        const evidence = [
          ...missingValueMatches.map((match) => ({
            type: 'MISSING_TRANSACTION_VALUE',
            description:
              'Mapped GA4 purchase transaction has no value available for comparison.',
            data: {
              orderId: match.order.id,
              transactionId: match.transaction.transactionId,
            },
          })),
          ...missingItemBasisMatches.map((match) => ({
            type: 'MISSING_ITEM_VALUE_BASIS',
            description:
              'Mapped source order has no item totals available for transaction value comparison.',
            data: {
              orderId: match.order.id,
              transactionId: match.transaction.transactionId,
            },
          })),
          ...currencyMismatchMatches.map((match) => ({
            type: 'INCOMPARABLE_TRANSACTION_CURRENCY',
            description:
              'GA4 transaction value and source item totals use different currencies.',
            data: {
              orderId: match.order.id,
              transactionId: match.transaction.transactionId,
              sourceCurrency: match.order.items[0]?.total.currency ?? null,
              observedCurrency: match.transaction.value?.currency ?? null,
            },
          })),
        ];

        const metrics = {
          matchedCount: mapping.matches.length,
          comparableCount,
          ...(missingValueMatches.length > 0
            ? { missingValueCount: missingValueMatches.length }
            : {}),
          ...(missingItemBasisMatches.length > 0
            ? { missingItemBasisCount: missingItemBasisMatches.length }
            : {}),
          ...(currencyMismatchMatches.length > 0
            ? { currencyMismatchCount: currencyMismatchMatches.length }
            : {}),
          affectedCount: unassessableCount,
        };

        return {
          checkId: 'TRANSACTION_VALUE_INTEGRITY',
          status: 'UNKNOWN',
          severity: 'WARNING',
          confidence: mapping.confidence,
          title: 'Some transaction values cannot be compared',
          summary:
            'Some mapped transactions lack a reliable basis for transaction value comparison.',
          metrics,
          evidence,
          possibleCauses: [],
          recommendations: [],
          limitations: [
            'Transaction value integrity cannot be fully determined for all mapped transactions.',
          ],
        };
      }

      return {
        checkId: 'TRANSACTION_VALUE_INTEGRITY',
        status: 'PASS',
        severity: 'INFO',
        confidence: mapping.confidence,
        title: 'Transaction values match',
        summary: 'Mapped GA4 purchase values match source item totals.',
        metrics: {
          matchedCount: mapping.matches.length,
          comparableCount,
          mismatchCount: 0,
        },
        evidence: [],
        possibleCauses: [],
        recommendations: [],
        limitations: [],
      };
    }

    const status =
      mapping.status === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT_DATA' : 'UNKNOWN';

    return {
      checkId: 'TRANSACTION_VALUE_INTEGRITY',
      status,
      severity: 'WARNING',
      confidence: mapping.confidence,
      title: 'Transaction value integrity cannot be determined',
      summary:
        'Transaction mapping is not resolved, so transaction values cannot be compared reliably.',
      metrics: {
        matchedCount: mapping.matches.length,
      },
      evidence: [
        {
          type: 'TRANSACTION_MAPPING_RESULT',
          description:
            'Transaction mapping required to compare transaction values.',
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
        'Transaction values cannot be compared until transaction mapping is resolved.',
      ],
    };
  },
};
