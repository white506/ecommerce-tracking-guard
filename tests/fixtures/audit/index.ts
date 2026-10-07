import { perfectFixture } from './01-perfect/fixture.js';
import { missingPurchasesFixture } from './02-missing-purchases/fixture.js';
import { revenueMismatchFixture } from './03-revenue-mismatch/fixture.js';
import { currencyErrorsFixture } from './04-currency-errors/fixture.js';
import { unresolvedMappingFixture } from './05-unresolved-mapping/fixture.js';
import { ambiguousMappingFixture } from './06-ambiguous-mapping/fixture.js';
import { missingItemsFixture } from './07-missing-items/fixture.js';
import { refundsFixture } from './08-refunds/fixture.js';
import { mixedErrorsFixture } from './09-mixed-errors/fixture.js';
import { smallSampleFixture } from './10-small-sample/fixture.js';
import type { GoldenAuditFixture } from './types.js';

export const goldenAuditFixtures: readonly GoldenAuditFixture[] = [
  perfectFixture,
  missingPurchasesFixture,
  revenueMismatchFixture,
  currencyErrorsFixture,
  unresolvedMappingFixture,
  ambiguousMappingFixture,
  missingItemsFixture,
  refundsFixture,
  mixedErrorsFixture,
  smallSampleFixture,
];

export function findGoldenAuditFixture(
  name: string,
): GoldenAuditFixture | undefined {
  return goldenAuditFixtures.find((fixture) => fixture.name === name);
}
