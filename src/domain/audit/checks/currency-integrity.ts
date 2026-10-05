import type { AuditCheck } from '../check.js';

export const currencyIntegrityCheck: AuditCheck = {
  id: 'CURRENCY_INTEGRITY',

  run: (context) => {
    const { mapping } = context;

    if (mapping.status !== 'RESOLVED') {
      const status =
        mapping.status === 'INSUFFICIENT_DATA'
          ? 'INSUFFICIENT_DATA'
          : 'UNKNOWN';

      return {
        checkId: 'CURRENCY_INTEGRITY',
        status,
        severity: 'WARNING',
        confidence: mapping.confidence,
        title: 'Currency integrity cannot be determined',
        summary:
          'Transaction mapping is not resolved, so currencies cannot be compared reliably.',
        metrics: {
          matchedCount: mapping.matches.length,
        },
        evidence: [
          {
            type: 'TRANSACTION_MAPPING_RESULT',
            description:
              'Transaction mapping required to compare transaction currencies.',
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
          'Transaction currencies cannot be compared until transaction mapping is resolved.',
        ],
      };
    }

    const missingCurrencyMatches = mapping.matches.filter(
      (match) => match.transaction.currency === null,
    );

    const mismatches = mapping.matches.filter(
      (match) =>
        match.transaction.currency !== null &&
        match.transaction.currency !== match.order.currency,
    );

    const valueCurrencyMismatches = mapping.matches.filter(
      (match) =>
        match.transaction.currency !== null &&
        match.transaction.value !== null &&
        match.transaction.value.currency !== match.transaction.currency,
    );

    const comparableCount =
      mapping.matches.length - missingCurrencyMatches.length;

    const mismatchCount = new Set([
      ...mismatches.map((match) => match.transaction.transactionId),
      ...valueCurrencyMismatches.map(
        (match) => match.transaction.transactionId,
      ),
    ]).size;

    if (mismatches.length > 0 || valueCurrencyMismatches.length > 0) {
      return {
        checkId: 'CURRENCY_INTEGRITY',
        status: 'FAIL',
        severity: 'WARNING',
        confidence: mapping.confidence,
        title: 'Transaction currency mismatches detected',
        summary:
          'Currency mismatches were detected in mapped GA4 transaction data.',
        metrics: {
          matchedCount: mapping.matches.length,
          comparableCount,
          mismatchCount,
          ...(missingCurrencyMatches.length > 0
            ? { missingCurrencyCount: missingCurrencyMatches.length }
            : {}),
          affectedCount: mismatchCount,
        },
        evidence: [
          ...mismatches.map((match) => ({
            type: 'TRANSACTION_CURRENCY_MISMATCH',
            description:
              'GA4 transaction currency differs from the source order currency.',
            data: {
              orderId: match.order.id,
              transactionId: match.transaction.transactionId,
              expectedCurrency: match.order.currency,
              observedCurrency: match.transaction.currency,
            },
          })),
          ...valueCurrencyMismatches.map((match) => ({
            type: 'TRANSACTION_VALUE_CURRENCY_MISMATCH',
            description:
              'GA4 transaction currency conflicts with its transaction value currency.',
            data: {
              orderId: match.order.id,
              transactionId: match.transaction.transactionId,
              transactionCurrency: match.transaction.currency,
              valueCurrency: match.transaction.value?.currency ?? null,
            },
          })),
          ...missingCurrencyMatches.map((match) => ({
            type: 'MISSING_TRANSACTION_CURRENCY',
            description:
              'Mapped GA4 transaction has no currency available for comparison.',
            data: {
              orderId: match.order.id,
              transactionId: match.transaction.transactionId,
              expectedCurrency: match.order.currency,
              observedCurrency: null,
            },
          })),
        ],
        possibleCauses: [],
        recommendations: [],
        limitations:
          missingCurrencyMatches.length > 0
            ? [
                `${missingCurrencyMatches.length} mapped transaction(s) could not be assessed for currency integrity.`,
              ]
            : [],
      };
    }

    if (missingCurrencyMatches.length > 0) {
      return {
        checkId: 'CURRENCY_INTEGRITY',
        status: 'UNKNOWN',
        severity: 'WARNING',
        confidence: mapping.confidence,
        title: 'Some transaction currencies cannot be compared',
        summary:
          'Some mapped GA4 transactions have no currency available for comparison.',
        metrics: {
          matchedCount: mapping.matches.length,
          comparableCount,
          missingCurrencyCount: missingCurrencyMatches.length,
          affectedCount: missingCurrencyMatches.length,
        },
        evidence: missingCurrencyMatches.map((match) => ({
          type: 'MISSING_TRANSACTION_CURRENCY',
          description:
            'Mapped GA4 transaction has no currency available for comparison.',
          data: {
            orderId: match.order.id,
            transactionId: match.transaction.transactionId,
            expectedCurrency: match.order.currency,
            observedCurrency: null,
          },
        })),
        possibleCauses: [],
        recommendations: [],
        limitations: [
          'Currency integrity cannot be fully determined for transactions without a GA4 currency.',
        ],
      };
    }

    return {
      checkId: 'CURRENCY_INTEGRITY',
      status: 'PASS',
      severity: 'INFO',
      confidence: mapping.confidence,
      title: 'Transaction currencies match',
      summary:
        'Mapped GA4 transaction currencies match source order currencies.',
      metrics: {
        matchedCount: mapping.matches.length,
        comparableCount: mapping.matches.length,
        mismatchCount: 0,
      },
      evidence: [],
      possibleCauses: [],
      recommendations: [],
      limitations: [],
    };
  },
};
