import type { AnalyticsTransaction } from '../analytics/models.js';
import type { CanonicalOrder } from '../commerce/models.js';
import type {
  MappingStrategy,
  TransactionMappingCandidate,
  TransactionMatch,
  TransactionMappingResult,
} from './models.js';
import type { ResolverPolicy } from './policy.js';

type Strategy = Readonly<{
  name: MappingStrategy;
  getIdentifier: (order: CanonicalOrder) => string | null;
}>;

type StrategyMatch = Readonly<{
  order: CanonicalOrder;
  transaction: AnalyticsTransaction;
  strategy: MappingStrategy;
}>;

type StrategyEvaluation = Readonly<{
  strategy: MappingStrategy;
  coverage: number;
  collision: boolean;
  matches: readonly StrategyMatch[];
}>;

const STRATEGIES: readonly Strategy[] = [
  {
    name: 'LEGACY_RESOURCE_ID',
    getIdentifier: (order) => order.identifiers.legacyResourceId,
  },
  {
    name: 'ORDER_NAME',
    getIdentifier: (order) => order.identifiers.name,
  },
  {
    name: 'ORDER_NAME_WITHOUT_HASH',
    getIdentifier: (order) => {
      const name = order.identifiers.name;

      return name !== null && name.startsWith('#') ? name.slice(1) : null;
    },
  },
  {
    name: 'ORDER_NUMBER',
    getIdentifier: (order) => order.identifiers.orderNumber,
  },
  {
    name: 'CONFIRMATION_NUMBER',
    getIdentifier: (order) => order.identifiers.confirmationNumber,
  },
];

function evaluateStrategy(
  strategy: Strategy,
  orders: readonly CanonicalOrder[],
  transactionsById: ReadonlyMap<string, AnalyticsTransaction>,
): StrategyEvaluation {
  const identifiers = orders
    .map(strategy.getIdentifier)
    .filter((identifier): identifier is string => identifier !== null);

  if (new Set(identifiers).size !== identifiers.length) {
    return {
      strategy: strategy.name,
      coverage: 0,
      collision: true,
      matches: [],
    };
  }

  const matches: StrategyMatch[] = [];

  for (const order of orders) {
    const identifier = strategy.getIdentifier(order);

    if (identifier === null) {
      continue;
    }

    const transaction = transactionsById.get(identifier);

    if (transaction === undefined) {
      continue;
    }

    matches.push({
      order,
      transaction,
      strategy: strategy.name,
    });
  }

  return {
    strategy: strategy.name,
    coverage: matches.length / orders.length,
    collision: false,
    matches,
  };
}

function mappingsAgree(
  left: StrategyEvaluation,
  right: StrategyEvaluation,
): boolean {
  if (left.matches.length !== right.matches.length) {
    return false;
  }

  const rightByOrderId = new Map(
    right.matches.map((match) => [
      match.order.id,
      match.transaction.transactionId,
    ]),
  );

  return left.matches.every(
    (match) =>
      rightByOrderId.get(match.order.id) === match.transaction.transactionId,
  );
}

export function resolveTransactions(
  orders: readonly CanonicalOrder[],
  transactions: readonly AnalyticsTransaction[],
  policy: ResolverPolicy,
): TransactionMappingResult {
  if (
    orders.length < policy.minimumSampleSize ||
    transactions.length < policy.minimumSampleSize
  ) {
    return {
      status: 'INSUFFICIENT_DATA',
      confidence: 'LOW',
      matches: [],
      candidates: [],
    };
  }

  const transactionIdCounts = new Map<string, number>();

  for (const transaction of transactions) {
    transactionIdCounts.set(
      transaction.transactionId,
      (transactionIdCounts.get(transaction.transactionId) ?? 0) + 1,
    );
  }

  if ([...transactionIdCounts.values()].some((count) => count > 1)) {
    return {
      status: 'AMBIGUOUS',
      confidence: 'LOW',
      matches: [],
      candidates: [],
    };
  }

  const transactionsById = new Map(
    transactions.map((transaction) => [transaction.transactionId, transaction]),
  );

  const evaluations = STRATEGIES.map((strategy) =>
    evaluateStrategy(strategy, orders, transactionsById),
  );

  const validEvaluations = evaluations
    .filter((evaluation) => !evaluation.collision)
    .sort((left, right) => right.coverage - left.coverage);

  const best = validEvaluations[0];
  const hasStrategyCollision = evaluations.some(
    (evaluation) => evaluation.collision,
  );

  if (best !== undefined && best.coverage === 0 && hasStrategyCollision) {
    return {
      status: 'AMBIGUOUS',
      confidence: 'LOW',
      matches: [],
      candidates: [],
    };
  }

  if (best === undefined) {
    return {
      status: evaluations.some((evaluation) => evaluation.collision)
        ? 'AMBIGUOUS'
        : 'UNRESOLVED',
      confidence: 'LOW',
      matches: [],
      candidates: [],
    };
  }

  const competingEvaluations = validEvaluations.filter(
    (evaluation) =>
      evaluation !== best &&
      evaluation.coverage > 0 &&
      best.coverage - evaluation.coverage <
        policy.minimumCoverageGap - Number.EPSILON,
  );

  if (
    competingEvaluations.some((evaluation) => !mappingsAgree(best, evaluation))
  ) {
    return {
      status: 'AMBIGUOUS',
      confidence: 'LOW',
      matches: [],
      candidates: [],
    };
  }

  const confidence =
    best.coverage >= policy.highConfidenceCoverage
      ? 'HIGH'
      : best.coverage >= policy.mediumConfidenceCoverage
        ? 'MEDIUM'
        : null;

  if (confidence !== null) {
    const matches: TransactionMatch[] = best.matches.map((match) => ({
      ...match,
      confidence,
    }));

    const candidates: TransactionMappingCandidate[] = matches.map((match) => ({
      orderId: match.order.id,
      transactionId: match.transaction.transactionId,
      strategy: match.strategy,
      confidence: match.confidence,
    }));

    return {
      status: 'RESOLVED',
      confidence,
      matches,
      candidates,
    };
  }

  return {
    status: 'UNRESOLVED',
    confidence: 'LOW',
    matches: [],
    candidates: [],
  };
}
