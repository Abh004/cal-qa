import { execFileSync } from "node:child_process";

import { defineConfig } from "cypress";

/**
 * Empties bookings (and rows that depend on them) and time-slot holds in the local test
 * database, so every booking test starts from the same state: 10:00 always free.
 * Holds matter because Cal.com reserves a time for a few minutes after a guest picks it
 * ("SelectedSlots"), so a previous test's pick would hide that time from the next test.
 * Host, schedule and event are untouched. Only ever points at the docker/compose.yml
 * test database; set CAL_DB_RESET=off when running against an instance you don't own.
 */
function clearBookings(): null {
  if (process.env.CAL_DB_RESET === "off") return null;
  const sql = 'TRUNCATE "Booking" CASCADE; TRUNCATE "SelectedSlots";';
  execFileSync("docker", ["compose", "-f", "docker/compose.yml", "exec", "-T", "db", "psql", "-U", "calcom", "-d", "calcom", "-q", "-c", sql], {
    stdio: "pipe",
  });
  return null;
}

export default defineConfig({
  e2e: {
    // The self-hosted Cal.diy instance started by `npm run app:up`. Cypress checks this
    // server is up before running any spec, so the API tests (which only call the hosted
    // Cal.com API) set CAL_BASE_URL=none to run without the local app.
    baseUrl: process.env.CAL_BASE_URL === "none" ? null : (process.env.CAL_BASE_URL ?? "http://localhost:3000"),
    setupNodeEvents(on) {
      on("task", { "db:clearBookings": clearBookings });
    },
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    viewportWidth: 1280,
    viewportHeight: 800,
    // Next.js pages can be slow on the first, uncached load after the container starts.
    defaultCommandTimeout: 10_000,
    pageLoadTimeout: 60_000,
    // Retry once in `cypress run` (CI and local runs); a pass on retry is still reported as flaky.
    // CAL_RETRIES=0 turns retries off, e.g. to prove stability (`--config retries=0` doesn't override this object).
    retries: { runMode: Number(process.env.CAL_RETRIES || 1), openMode: 0 },
    video: true,
    screenshotOnRunFailure: true,
    expose: {
      // Hosted Cal.com public API (API tests). The event belongs to the tester's own
      // cal.com account, so it isn't committed: set CAL_API_USERNAME (and optionally
      // CAL_API_EVENT_SLUG) locally, or as a GitHub Actions secret in CI.
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
