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
npm run test:api   # Cal.com public API tests
npm run app:down   # stops everything and deletes the test database
```

`npm run app:up` picks the right image for your machine (`calcom/cal.com:v6.2.0`, or `v6.2.0-arm` on Apple Silicon). Set `CALDIY_IMAGE` to test a different version.

### Test data

The seed (`docker/seed/seed-qa.ts`) creates:

| | |
|---|---|
| Host | `qa-host` (`qa-host@cal-qa.test`), time zone America/New_York |
| Availability | Monday to Friday, 09:00–17:00 New York time |
| Event | "30 min meeting" at http://localhost:3000/qa-host/30min |

The host's password is a test-only value in `cypress/support/test-data.ts`. It exists only in the local test instance.
