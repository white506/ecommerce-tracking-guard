export type ResolverPolicy = Readonly<{
  minimumSampleSize: number;
  highConfidenceCoverage: number;
  mediumConfidenceCoverage: number;
  minimumCoverageGap: number;
}>;

export const RESOLVER_POLICY_V1: ResolverPolicy = {
  minimumSampleSize: 5,
  highConfidenceCoverage: 0.95,
  mediumConfidenceCoverage: 0.8,
  minimumCoverageGap: 0.1,
};
