export type AuditPolicy = Readonly<{
  monetaryToleranceMinor: bigint;
}>;

export const AUDIT_POLICY_V1: AuditPolicy = {
  monetaryToleranceMinor: 0n,
};
