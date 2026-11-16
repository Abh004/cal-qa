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

## What's tested

| Spec | Test | Why it's here |
|---|---|---|
| `booking/tc01-booking-smoke.cy.ts` | **TC-01 (smoke):** book 10:00 on the next weekday; the confirmation shows the right event, date, time, time zone and guest | If this fails on your deployment, nothing else matters |
| `booking/tc03-cross-timezone.cy.ts` | **TC-03 (regression):** a Kolkata guest books 10:00 New York, sees it in Kolkata time, and the host's list shows 10:00 for the same booking | Wrong-time meetings fail silently; upstream only tests this maths in isolation |
| `booking/tc06-daylight-saving.cy.ts` | **TC-06 (edge case):** the same booking on either side of New York's next clock change shifts by an hour in Kolkata, while the host still sees 10:00 and working hours still start at 09:00 | Twice a year, getting this wrong moves every cross-zone meeting |
| `api/slots-api.cy.ts` | **API-01 to API-05:** Cal.com's public slots API returns well-formed times, the same moments in other time zones, and clear errors | The endpoint behind every public booking page |

Expected times are calculated in the tests with luxon, never typed in, so the tests stay correct in every season. Before each booking test, the local test database's bookings and time holds are emptied, so 10:00 is always free. All test scripts run Chrome in UTC (`TZ=UTC`), the same as CI.

### Test data

The seed (`docker/seed/seed-qa.ts`) creates:

| | |
|---|---|
| Host | `qa-host` (`qa-host@cal-qa.test`), time zone America/New_York |
| Availability | Monday to Friday, 09:00–17:00 New York time |
| Event | "30 min meeting" at http://localhost:3000/qa-host/30min |

The host's password is a test-only value in `cypress/support/test-data.ts`. It exists only in the local test instance.
