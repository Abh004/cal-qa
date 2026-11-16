# cal-qa

An upgrade check for a team that self-hosts **Cal.diy** (the open-source edition of Cal.com): Cypress tests for the public booking flow, plus API tests against Cal.com's public slots API.

> Work in progress. Decisions, assumptions and the test list are in [docs/decisions.md](docs/decisions.md).

## Requirements

- Docker (Docker Desktop or OrbStack)
- Node 24 (`nvm use`) and Google Chrome

## Quick start

```bash
npm install
npm run app:up     # starts Cal.diy v6.2.0 + Postgres, waits for it, seeds the test host
npm run test:e2e   # booking-flow tests (Chrome)
npm run app:down   # stops everything and deletes the test database
```

The API tests don't need Docker. They read a public event from a cal.com account:

```bash
CAL_API_USERNAME=<your-cal.com-username> npm run test:api   # event slug defaults to 30min (CAL_API_EVENT_SLUG)
```

Without `CAL_API_USERNAME` they're skipped locally. Tests for already-reported bugs are skipped too; add `INCLUDE_KNOWN_BUGS=true` to run them.

`npm run app:up` picks the right image for your machine (`calcom/cal.com:v6.2.0`, or `v6.2.0-arm` on Apple Silicon). Set `CALDIY_IMAGE` to test a different version.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to `main` and every pull request, in two parallel jobs:

| Job | What it does |
|---|---|
| **API tests** | Runs `cypress/e2e/api` in Chrome. Needs the `CAL_API_USERNAME` repository secret (a secret, so it's masked in logs) |
| **Booking-flow tests** | Starts Cal.diy + Postgres with `npm run app:up`, seeds the test host, runs `cypress/e2e/booking` in Chrome. Uploads videos on every run, and screenshots + Cal.diy logs when something fails |

**Upgrade check:** run the workflow by hand (Actions → CI → Run workflow) and enter the Cal.diy image to test, for example the next release, before deploying it.

## What's tested

| Spec | Test | Why it's here |
|---|---|---|
| `booking/tc01-booking-smoke.cy.ts` | **TC-01 (smoke):** book 10:00 on the next weekday; the confirmation shows the right event, date, time, time zone and guest | If this fails on your deployment, nothing else matters |
| `booking/tc03-cross-timezone.cy.ts` | **TC-03 (regression):** a Kolkata guest books 10:00 New York, sees it in Kolkata time, and the host's list shows 10:00 for the same booking | Wrong-time meetings fail silently; upstream only tests this maths in isolation |
| `booking/tc06-daylight-saving.cy.ts` | **TC-06 (edge case):** the same booking on either side of New York's next clock change shifts by an hour in Kolkata, while the host still sees 10:00 and working hours still start at 09:00 | Twice a year, getting this wrong moves every cross-zone meeting |
| `api/slots-api.cy.ts` | **API-01 to API-06:** Cal.com's public slots API returns well-formed times, the same moments in other time zones, and clear errors. API-05 and API-06 cover known bugs and are skipped in normal runs | The endpoint behind every public booking page |

Expected times are calculated in the tests with luxon, never typed in, so the tests stay correct in every season. Before each booking test, the local test database's bookings and time holds are emptied, so 10:00 is always free. All test scripts run Chrome in UTC (`TZ=UTC`), the same as CI.

### Test data

The seed (`docker/seed/seed-qa.ts`) creates:

| | |
|---|---|
| Host | `qa-host` (`qa-host@cal-qa.test`), time zone America/New_York |
| Availability | Monday to Friday, 09:00–17:00 New York time |
| Event | "30 min meeting" at http://localhost:3000/qa-host/30min |

The host's password is a test-only value in `cypress/support/test-data.ts`. It exists only in the local test instance.

## Bugs found

**[BUG-002 (S3 Medium)](docs/bugs/BUG-002-slots-duration-not-validated.md):** Cal.com's slots API rebuilds a fixed-length event's availability around any `duration` it's sent. For a 30-minute event, `duration=60` hides half the host's times and `duration=1440` hides all of them, both as a normal `200`. It reproduces on hosted cal.com and on self-hosted v6.2.0. The full list, including smaller issues, is in [docs/bugs](docs/bugs/README.md).
