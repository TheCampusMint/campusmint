export const accountCapabilityValues = [
  "creator",
  "create_groups",
  "create_channels",
  "owner_campus_tester",
  "creator_reviewer",
  "future_monetization_eligible",
] as const;

export type AccountCapability = (typeof accountCapabilityValues)[number];

export function hasAccountCapability(
  capabilities: readonly AccountCapability[],
  capability: AccountCapability,
) {
  return capabilities.includes(capability);
}
