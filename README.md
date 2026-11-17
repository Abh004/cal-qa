# cal-qa

An upgrade check for a team that self-hosts **Cal.diy**, the open-source edition of Cal.com. It has two parts:

- Cypress tests that book real meetings through the public booking page.
- API tests against Cal.com's public slots API.

Before deploying a new Cal.diy version, run this suite against it. If it's green, ship the upgrade.

| | |
|---|---|
| **Test plan** (one page) | [docs/test-plan.md](docs/test-plan.md) |
| **Green CI run** | [run 43873531308](https://github.com/Abh004/cal-qa/actions/runs/43873531308) on `main` |
| **Red CI run, caused on purpose** | [run 43843717218](https://github.com/Abh004/cal-qa/actions/runs/43843717218) on the do-not-merge pull request [Abh004/cal-qa#1](https://github.com/Abh004/cal-qa/pull/1) |
| **Bug report** | [BUG-002: the slots API reshapes a fixed-length event's availability around any `duration` (S3)](docs/bugs/BUG-002-slots-duration-not-validated.md) |
| **What to automate next, what to leave manual** | [docs/automate-next.md](docs/automate-next.md) |
| Decisions, assumptions, findings log | [docs/decisions.md](docs/decisions.md) |

## Why this exists when Cal.com has 500 tests

Cal.com's own tests answer *"did this code change break Cal.com?"* They run against source code, before a change is merged, with test data inserted straight into the database.

A team that self-hosts Cal.com needs a different answer: *"does the version **we deploy**, with **our** settings, still book meetings correctly?"* Cal.com's suite never runs against that. It also checks time-zone maths only in isolated unit tests, and never follows a booking end to end from a guest in one country to a host in another.

So this suite doesn't copy Cal.com's tests. It covers:
- **one smoke test** that runs against our deployment;
- **the gaps between Cal.com's unit tests**, where silent failures live.

## The 3 automated tests, and why these 3

| Test | What it does | Why it was picked |
|---|---|---|
| **TC-01: smoke** <br> [`tc01-booking-smoke.cy.ts`](cypress/e2e/booking/tc01-booking-smoke.cy.ts) | A guest books 10:00 on the next weekday. The confirmation shows the right event, date, time, time zone and guest | If people can't book on *our* deployment, nothing else matters. It's the one test Cal.com can't run for us |
| **TC-03: regression** <br> [`tc03-cross-timezone.cy.ts`](cypress/e2e/booking/tc03-cross-timezone.cy.ts) | A guest in Kolkata books 10:00 New York. They see the correct Kolkata time, and the host's bookings list shows 10:00 for that same booking | Wrong-hour meetings are the worst failure a scheduler can have, because everything *looks* fine until two people miss each other. Cal.com tests the maths only in isolation. The [red run](https://github.com/Abh004/cal-qa/actions/runs/43843717218) shows this test catching a host time-zone regression that the smoke test misses |
| **TC-06: edge case** <br> [`tc06-daylight-saving.cy.ts`](cypress/e2e/booking/tc06-daylight-saving.cy.ts) | The same booking on the weekdays either side of a clock change, from both sides. **A, the host's clocks change:** a New York host and a Kolkata guest. The guest's time moves by an hour, the host still sees 10:00, and the host's day still starts at 09:00. **B, the guest's clocks change:** an India host and a New York guest. India never changes its clocks, but the guest's clock moves by an hour across midnight, so the meeting appears under a different date for the guest on one side of the change (March 2027: Thursday 23:30, then Monday 00:30) | It breaks twice a year, at exactly the moment nobody is testing by hand, and B also puts the meeting on the wrong day. The test finds the next clock change itself, so it never goes stale |

**Why not double booking (TC-02)?** Cal.com's own suite already tests it directly, so repeating it here would add maintenance without catching anything new. Simultaneous double booking (TC-04) is first in line to automate next.

**What keeps these tests reliable:**
- **Expected times are calculated, not typed in.** Every expected time comes from luxon, so the tests are correct in every season.
- **Times are picked by moment, not by label.** Each time button carries its exact UTC moment, so the tests click the moment they mean and check the label shown to the guest separately.
- **Every test starts from a clean state.** Before each booking test, the test database's bookings and time holds are emptied.
- **The browser's time zone is fixed.** Every script runs Chrome in UTC (`TZ=UTC`), the same as CI, so the computer's own zone can't hide a bug.

## Requirements

- Docker (Docker Desktop or OrbStack)
- Node 22 or newer (`.nvmrc` says 24) and Google Chrome

## How to run it

```bash
npm install
npm run app:up     # starts Cal.diy v6.2.0 + Postgres, waits for it, seeds the test host (~1-2 min the first time)
npm run test:e2e   # the 3 booking-flow tests, in Chrome
npm run app:down   # stops everything and deletes the test database
```

`npm run app:up` picks the right image for your machine: `calcom/cal.com:v6.2.0`, or `v6.2.0-arm` on Apple Silicon. Set `CALDIY_IMAGE` to test another version. To watch the tests run, use `npm run cy:open`.

### API tests

These don't need Docker. They read a public event from any cal.com account (free accounts work):

```bash
CAL_API_USERNAME=<a-cal.com-username> npm run test:api   # event slug defaults to 30min (CAL_API_EVENT_SLUG)
```

Without `CAL_API_USERNAME`, they're skipped locally.

Tests for already-reported bugs (API-05 and API-06) are skipped too. To see them fail until the bugs are fixed, run:

```bash
INCLUDE_KNOWN_BUGS=true npm run test:api
```

**Why test hosted Cal.com's API?** It's the public API that Cal.com's customers build their own booking pages on, and it needs no key to read availability. Self-hosted Cal.diy doesn't include it.

| Spec | Checks |
|---|---|
| [`slots-api.cy.ts`](cypress/e2e/api/slots-api.cy.ts) | **API-01:** well-formed times, in order, inside the range, on the event's grid. **API-02:** the same moments in another time zone. **API-03 and API-04:** a clear `404` or `400` naming the bad field. **API-05 and API-06:** known bugs BUG-001 and BUG-002. Responses are checked with zod schemas, and the API version header is pinned |

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs two jobs in parallel on every push to `main` and every pull request.

| Job | What it does |
|---|---|
| **API tests** | Runs `cypress/e2e/api` in Chrome. It needs the `CAL_API_USERNAME` repository secret (a secret, so it's masked in logs) |
| **Booking-flow tests** | Starts Cal.diy and Postgres with `npm run app:up`, seeds the test host, then runs `cypress/e2e/booking` in Chrome. Uploads videos on every run, plus screenshots and the Cal.diy logs when something fails |

Each run takes about 3 minutes.

**Upgrade check:** run the workflow by hand (Actions → CI → Run workflow) and enter the Cal.diy image to test, for example the next release.

**About the red run:** [Abh004/cal-qa#1](https://github.com/Abh004/cal-qa/pull/1) changes no test code. It saves the host's profile time zone as London, while their working hours stay on New York. That's a realistic misconfiguration:
- Guests can still book, so TC-01 and the API tests pass.
- The host's dashboard shows every meeting at 3:00pm instead of 10:00am, so TC-03 and TC-06 fail.

## Test data

The seed ([`docker/seed/seed-qa.ts`](docker/seed/seed-qa.ts)) creates:

| | |
|---|---|
| Hosts | `qa-host` (`qa-host@cal-qa.test`), time zone America/New_York <br> `qa-host-in` (`qa-host-in@cal-qa.test`), time zone Asia/Kolkata, used by TC-06 B |
| Availability | Monday to Friday, 09:00–17:00 in each host's own time zone |
| Events | "30 min meeting" at http://localhost:3000/qa-host/30min and http://localhost:3000/qa-host-in/30min |

The hosts' password is a test-only value in [`cypress/support/test-data.ts`](cypress/support/test-data.ts), and exists only in the local test instance. `docker/make-env.sh` generates throwaway app secrets into the git-ignored `docker/.env`.

## Bugs found

**[BUG-002 (S3 Medium)](docs/bugs/BUG-002-slots-duration-not-validated.md):** Cal.com's slots API rebuilds a fixed-length event's availability around any `duration` it's sent. For a 30-minute event:
- `duration=60` hides half the host's times;
- `duration=1440` hides all of them.

Both come back as a normal `200`. It reproduces on hosted cal.com and on self-hosted v6.2.0. The full list, including smaller issues, is in [docs/bugs](docs/bugs/README.md).

## Repo layout

```text
cypress/e2e/booking/   TC-01, TC-03, TC-06 (UI, against the local Cal.diy)
cypress/e2e/api/       API-01 to API-06 (hosted Cal.com public API)
cypress/support/       login, booking and time-zone helpers; test data; API client and schemas
docker/                compose file, secret generator, seed script
scripts/app-up.sh      start, wait for, and seed the app
docs/                  test plan, bug reports, automate-next, decisions log
```
