/**
 * Development fixtures are opt-in. `NODE_ENV=development` alone is not enough:
 * preview and local production-like sessions must exercise empty/real data paths.
 */
export function areDevelopmentFixturesEnabled(
  environment: Record<string, string | undefined> = process.env,
) {
  return (
    environment.NODE_ENV === "test" ||
    Boolean(environment.NODE_TEST_CONTEXT) ||
    (environment.NODE_ENV === "development" &&
      environment.NEXT_PUBLIC_CAMPUS_MINT_ENABLE_FIXTURES === "true")
  );
}

export function areDeveloperControlsEnabled(
  environment: Record<string, string | undefined> = process.env,
) {
  return (
    environment.NODE_ENV === "development" &&
    environment.NEXT_PUBLIC_CAMPUS_MINT_ENABLE_DEV_CONTROLS === "true"
  );
}
