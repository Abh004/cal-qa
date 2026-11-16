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
    env: {
      // Hosted Cal.com public API (API tests). Set CYPRESS_API_USERNAME / CYPRESS_API_EVENT_SLUG
      // to a public event in your own cal.com account.
      apiBaseUrl: "https://api.cal.com/v2",
      apiVersion: "2024-09-04",
      apiUsername: "",
      apiEventSlug: "",
    },
  },
});
