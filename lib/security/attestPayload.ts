export function assertionPayload(input: { challengeId: string; challenge: string; userId: string; method: string; path: string; bodyHash: string }) {
  return ["campusmint/v1", input.challengeId, input.challenge, input.userId, input.method, input.path, input.bodyHash].join("\n");
}

export function attestConfiguration(env: Record<string, string | undefined>) {
  const configured = /^[A-Z0-9]{10}$/.test(env.APPLE_TEAM_ID ?? "") && /^[A-Za-z0-9.-]+\.[A-Za-z0-9.-]+$/.test(env.APPLE_BUNDLE_ID ?? "");
  // Production activation requires a separately recorded device/security review.
  const enabled = configured && env.APP_ATTEST_ENABLED === "true" && (env.NODE_ENV !== "production" || env.APP_ATTEST_REVIEWED === "true");
  return { enabled, required: env.APP_ATTEST_REQUIRED === "true", teamIdentifier: env.APPLE_TEAM_ID ?? "", bundleIdentifier: env.APPLE_BUNDLE_ID ?? "", allowDevelopmentEnvironment: env.NODE_ENV !== "production" && env.APP_ATTEST_ALLOW_DEVELOPMENT === "true" };
}
