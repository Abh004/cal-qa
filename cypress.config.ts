import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    // The self-hosted Cal.diy instance started by `npm run app:up`.
    baseUrl: process.env.CAL_BASE_URL ?? "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    viewportWidth: 1280,
    viewportHeight: 800,
    // Next.js pages can be slow on the first, uncached load after the container starts.
    defaultCommandTimeout: 10_000,
    pageLoadTimeout: 60_000,
    // Retry once in CI only; a test that passes on retry still shows as flaky in the report.
    retries: { runMode: 1, openMode: 0 },
    video: true,
    screenshotOnRunFailure: true,
    expose: {
      // Hosted Cal.com public API (API tests). The event belongs to the tester's own
      // cal.com account, so it isn't committed: set CAL_API_USERNAME (and optionally
      // CAL_API_EVENT_SLUG) locally, or as a GitHub Actions variable in CI.
      apiBaseUrl: "https://api.cal.com/v2",
      apiVersion: "2024-09-04", // pinned, so a new API version can't silently change responses
      apiUsername: process.env.CAL_API_USERNAME ?? "",
      apiEventSlug: process.env.CAL_API_EVENT_SLUG ?? "30min",
      apiEventLengthMinutes: Number(process.env.CAL_API_EVENT_LENGTH ?? 30),
      // In CI a missing username is an error; locally the API tests are skipped with a message.
      requireApiConfig: Boolean(process.env.CI),
      // Tests for known, already-reported bugs are skipped unless this is set (see docs/bugs).
      includeKnownBugs: process.env.INCLUDE_KNOWN_BUGS === "true",
    },
  },
});
