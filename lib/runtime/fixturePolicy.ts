/**
 * Development fixtures are opt-in. `NODE_ENV=development` alone is not enough:
 * preview and local production-like sessions must exercise empty/real data paths.
 */
export function areDevelopmentFixturesEnabled(
  environment: Record<string, string | undefined> = {
    NODE_ENV: process.env.NODE_ENV,
    NODE_TEST_CONTEXT: process.env.NODE_TEST_CONTEXT,
    NEXT_PUBLIC_CAMPUS_MINT_ENABLE_FIXTURES: process.env.NEXT_PUBLIC_CAMPUS_MINT_ENABLE_FIXTURES,
    NEXT_PUBLIC_CAMPUS_MINT_ENABLE_DEV_CONTROLS: process.env.NEXT_PUBLIC_CAMPUS_MINT_ENABLE_DEV_CONTROLS,
  },
) {
  return (
    environment.NODE_ENV === "test" ||
    Boolean(environment.NODE_TEST_CONTEXT) ||
    (environment.NODE_ENV === "development" &&
      environment.NEXT_PUBLIC_CAMPUS_MINT_ENABLE_FIXTURES === "true")
  );
}

export function areDeveloperControlsEnabled(
  environment: Record<string, string | undefined> = {
    NODE_ENV: process.env.NODE_ENV,
    NODE_TEST_CONTEXT: process.env.NODE_TEST_CONTEXT,
    NEXT_PUBLIC_CAMPUS_MINT_ENABLE_FIXTURES: process.env.NEXT_PUBLIC_CAMPUS_MINT_ENABLE_FIXTURES,
    NEXT_PUBLIC_CAMPUS_MINT_ENABLE_DEV_CONTROLS: process.env.NEXT_PUBLIC_CAMPUS_MINT_ENABLE_DEV_CONTROLS,
  },
) {
  return (
    environment.NODE_ENV === "development" &&
    environment.NEXT_PUBLIC_CAMPUS_MINT_ENABLE_DEV_CONTROLS === "true"
  );
}
