# Decisions and findings log

## 1. What this is, and for whom

**An upgrade check for a team that self-hosts Cal.diy** (the open-source edition of Cal.com).

Cal.com's own ~500 test files answer *"did our code change break Cal.com?"*: they run on Cal.com's source code before a change is merged, with test data inserted straight into the database. This suite answers a different question:
*"Does the version **we deploy** still book meetings correctly for **our** users?"*

- **Owner:** the team running Cal.diy (or a company whose product relies on Cal.com's booking pages).
- **Who it protects:** invitees and hosts. The worst failures are quiet ones: a meeting at the wrong time, a double booking, or times offered when the host isn't free.
- **How it's used:** change the image version (`CALDIY_IMAGE=v6.2.0` → the next version), run the suite, and upgrade only if it's green.
- **Who reads it now:** the reviewer, judging what was chosen to test, what was left alone, and why.

**What it does on each run:** starts the pinned Cal.diy Docker image with Postgres, creates a known host and event, runs 3 Cypress tests through the real booking page plus API tests against Cal.com's public slots API, and reports in GitHub Actions with screenshots and videos when something fails.

**Out of scope:** setting up hosts and event types, teams and organisations, routing forms, payments, calendar connections, email delivery, load testing.

### Gaps upstream that this suite targets

| Gap | Evidence in `calcom/cal.diy` |
|---|---|
| Guest and host in different time zones see the same moment, end to end | Time-zone tests check the maths in isolation (`getSchedule.test.ts`, `timezone-conversion.test.ts`); `booking-pages.e2e.ts` never mentions a time zone |
| Booking end to end in the week clocks change | Covered only by those isolated tests |
| How the slots API responds to bad requests, from a caller's view | `start` after `end` returns 200 with no times instead of 400 (found 2026-11-15) |
| Booking limits per day, week and month in the browser | That test is marked `test.fixme` (switched off) in `booking-limits.e2e.ts` |

## 2. Assumptions the brief doesn't state

| # | Assumption | Why |
|---|---|---|
| A1 | "The app" is Cal.com, tested through **Cal.diy v6.2.0** (`calcom/cal.com:v6.2.0` on Docker Hub, the latest release) | Clean, reproducible setup. Trade-off: hosted cal.com may run newer code |
| A2 | "The flow" is the **invitee booking flow**. The host side is used only to check results | It's where a user is hurt most if something breaks |
| A3 | The API test hits **hosted Cal.com's `GET /v2/slots`**, read-only, against an event in our own free account | The app's own public API; it needs no key. Trade-off: not the same copy of the app as the UI tests |
| A4 | Running the app ourselves in CI counts as "running it in CI" | The brief doesn't require testing a live site; a self-run copy is reliable |
| A5 | Test host `qa-host`: America/New_York, Mon–Fri 09:00–17:00, one 30-minute event. A second host, `qa-host-in` (Asia/Kolkata, same hours and event), lets TC-06 test a clock change on the guest's side (section 12) | Fixed data means expected results can be stated in advance |
| A6 | English language, desktop window 1280×800 | Keeps the 3 tests focused; phone sizes come next |
| A7 | No email server, so emails aren't checked automatically | A local test mail server (Mailpit) comes next |
| A8 | The red run lives on the unmerged branch `demo/red-run` with an open pull request | `main` stays green, and the red run is easy to link |
| A9 | The bug must reproduce on v6.2.0 and is also checked on hosted cal.com | Shows how far it reaches; can be reported upstream |
| A10 | A reviewer either has Docker and Node 22+, or just reads the CI runs | The README covers both |
| A11 | A full CI run takes under about 12 minutes | Fast enough for every pull request |
| A12 | CI retries a failed test once, and a test that only passes on retry is still reported | No silent retries hiding flaky tests |
| A13 | We don't duplicate tests Cal.com already has, except the smoke test | Every deployment needs its own "can people book?" check; the rest would be redundant |

## 3. Test list

Starting data for every test: host `qa-host`, 30-minute event, Mon–Fri 9–5 New York time, fresh database each run.
"Target day" means the next weekday at least 2 days ahead. Expected times are **calculated in the test** (with luxon), never typed in by hand.

### Booking flow, ordered by harm if broken

| ID | Test case | Expected result | Covered upstream? | Status |
|---|---|---|---|---|
| **TC-01** | Guest books 10:00 on the target day, in the host's own time zone | Confirmation shows the event name, date, 10:00–10:30, the time zone and the guest's email | Yes (`booking-pages.e2e.ts`), but not against *our* deployment | **Automate (smoke)** |
| TC-02 | Book a time, then open the same day as a new visitor | The booked time isn't offered; the times either side still are | Yes: "cannot book same slot multiple times" | Rely on upstream |
| **TC-03** | A guest set to Kolkata time books the time that is 10:00 in New York; the host checks their bookings | The guest's confirmation shows the calculated Kolkata time; the host's bookings list shows 10:00 New York time for the same booking | Only the maths, in isolation | **Automate (regression)** |
| TC-04 | Two people try to book the same time at the same moment | Exactly one booking succeeds; the other is clearly rejected | Partly (times are held while someone is choosing) | Next |
| TC-05 | Times offered on weekends, outside 9–5, and on days the host has changed | Nothing is offered outside the host's availability | Yes, in isolated tests | Rely on upstream |
| **TC-06** | Daylight-saving week: a Kolkata guest books 10:00 New York time on the weekday **before** and the weekday **after** the next US clock change | The first time offered each day is 09:00 New York, and the guest's Kolkata times shift by one hour across the change (for Mar 14 2027: 20:30 before, 19:30 after). Both confirmations and the host's list show 10:00 New York. **Also the reverse (added later, section 12):** an India host and a New York guest, where the guest finds each meeting under their own date | Only the maths, in isolation | **Automate (edge case)** |
| TC-07 | Minimum notice, buffer between meetings, how far ahead people can book | Times that break those rules aren't offered | Partly (limits test switched off) | Next |
| TC-08 | Blank name, badly formatted email, very long or non-Latin name | Clear errors and no booking created; valid unusual names still work | Partly | Next |
| TC-09 | Reschedule and cancel through the booking's link | The old time is freed and the new one blocked; a cancelled time is offered again | Yes (`reschedule.e2e.ts`) | Rely on upstream |
| TC-10 | Confirmation email and calendar invite | Both show the right time and time zone | Not end to end | Manual (until Mailpit is added) |

TC-06 finds the next clock change itself (the next date New York's UTC offset changes, at least 3 days ahead), so it keeps working after March 2027.

### API tests (`GET https://api.cal.com/v2/slots`, header `cal-api-version: 2024-09-04`)

| ID | Request | Expected result |
|---|---|---|
| API-01 | A valid event over a 3-day range | 200; response has the expected structure; every time is inside the range, in order, 30 minutes apart |
| API-02 | Same request with `timeZone=Asia/Kolkata` | The same moments as API-01, shown with `+05:30` |
| API-03 | An event that doesn't exist | 404 with an error message |
| API-04 | A badly formatted date, or an invalid time zone | 400 with a message naming the bad field |
| API-05 | `start` after `end` | Should be 400. **Today it returns 200 with no times** ([BUG-001](bugs/BUG-001-slots-start-after-end.md)). The test is skipped in normal runs, so `main` stays green and the test shows as pending. Run with `INCLUDE_KNOWN_BUGS=true` to see it fail until it's fixed |
| API-06 | The same fixed-length event with `duration` set to twice its length, or to a whole day | The times shouldn't change: either the same times or a 400 naming `duration`. **Today it changes them: half the times, or none** ([BUG-002](bugs/BUG-002-slots-duration-not-validated.md)). Skipped like API-05 |

**API test settings:** the event lives in the tester's own cal.com account, so its username isn't committed. Set `CAL_API_USERNAME` locally, or as a GitHub Actions repository **secret** (not a plain variable: secrets are masked in logs, and a failing API test's message includes the request path, which contains the username). `CAL_API_EVENT_SLUG` defaults to `30min`. Locally, the API tests skip with a message if the username is missing; in CI (`CI=true`) they fail instead. The `cal-api-version` header is pinned to `2024-09-04`, and responses are checked with zod schemas.

## 4. Build order

| Step | Work | Done when | Time limit |
|---|---|---|---|
| 0 | This document | Decisions written down | Done |
| 1 | **Spike:** install Docker (OrbStack), run Cal.diy v6.2.0 with Postgres, find a reliable way to create the test user (in order: the project's own seed script, then a SQL file, then the first-run setup page). Check the booking page's `data-testid` selectors, and that bookings months ahead are allowed (needed for TC-06) | Log in as `qa-host` and book a time by hand at localhost:3000 | **4 hours**, then fall back to hosted cal.com |
| 2 | Set up the repo: git, a public GitHub repo, Cypress + TypeScript, `docker/` setup, seed step, `npm run app:up` / `app:seed` / `test:e2e` / `test:api` | One command brings the app up and seeds it | 2 hours |
| 3 | API-01 to API-05 | They pass locally, with API-05 failing for the expected reason | 2 hours |
| 4 | TC-01, then TC-03, then TC-06, plus helpers (fast login with `cy.session`, date picking, time-zone maths with luxon) | Each passes 5 times in a row locally | 1 day |
| 5 | GitHub Actions: an API job and a UI job, screenshots and videos uploaded, a results summary | A green run on `main` | 3 hours |
| 6 | Red run: on `demo/red-run`, change TC-03 to expect the guest's local time on the host's list, and open a pull request | A red run whose screenshot shows the time mismatch | 30 min |
| 7 | Bug hunt, then write it up (steps, expected, actual, severity, why) | Reproduced on v6.2.0 and checked on hosted cal.com | 3 hours |
| 8 | One-page test plan, README (including "Why this exists when Cal.com has 500 tests"), automate-next doc; then clone fresh and follow the README | A stranger can run it from the README alone | Half a day |

**Biggest risks:**
- **Cal.diy won't start or can't be seeded:** step 1's time limit and the hosted fallback cover this.
- **Selectors differ in v6.2.0:** the spike checks them.
- **Time-dependent flakiness:** target days are 2+ days ahead, and expected times are calculated in the test.
- **Hosted API changes:** the `cal-api-version` header is pinned.

**Needed from you:**
- Your OK to install Docker (OrbStack).
- A free cal.com account with a public 30-minute event, for the API tests.

**Optional extra:** a pull request to `calcom/cal.diy` that turns the disabled booking-limits test back on.

## 5. Spike results (2026-11-16)

| Question | Answer |
|---|---|
| Does Cal.diy v6.2.0 run locally? | Yes. `docker/compose.yml` runs Postgres 16 and the app. Image tag is the `CALDIY_IMAGE` setting: `calcom/cal.com:v6.2.0-arm` on Apple Silicon, `calcom/cal.com:v6.2.0` (amd64 only) in CI |
| Secrets | `docker/make-env.sh` writes `docker/.env` (git-ignored) with throwaway values, including Web Push keys made with Node's crypto (no extra npm package) |
| How is the test host created? | `docker/seed.sh` copies `docker/seed/seed-qa.ts` into the container and runs it with the image's own `ts-node`, through the app's Prisma client. It follows the pinned schema (no hand-written SQL) and can be re-run safely. Result: `qa-host`, a Mon–Fri 09:00–17:00 New York schedule, and the `/qa-host/30min` event |
| First-run setup page? | Before seeding, `/auth/login` redirects to `/auth/setup`. After seeding it loads normally |
| Booking page | `/qa-host/30min` renders the month view with correct times (Kolkata browser: Monday's first time is 19:30, which is 09:00 New York) |
| Booking ahead | Events allow any distance ahead by default (`periodType UNLIMITED`), so TC-06 can book next March. Minimum notice defaults to 120 minutes |
| Stable selectors | `day` (with `data-disabled`), `time` (with **`data-time` = the exact moment in UTC**, e.g. `2026-11-18T15:00:00.000Z`), `timezone-select`, `incrementMonth`, `decrementMonth`, `selected-month-label`, `event-title`, `event-meta-current-timezone`, `booker-container` |
| Browser time zone | The booking page defaults to the machine's time zone, so every test must set the guest's time zone itself |

**What the selectors mean for the tests:** TC-03 and TC-06 can pick "10:00 New York" by its exact UTC moment (`[data-testid="time"][data-time="…Z"]`), worked out with luxon, and then check the *displayed* label separately. That keeps "which time did we pick" apart from "how is it shown".

| Booking end to end | Booking 10:00 New York on Wed 2026-11-18 through the page's own endpoint (`POST /api/book/event`) returned `status: ACCEPTED`. Its confirmation page `/booking/<uid>` showed "This meeting is scheduled", 20:30–21:00 India Standard Time (correct for a Kolkata browser) |
| Confirmation page selectors | `success-page`, `booking-title`, `booking-host-name`, `booking-host-email`, `attendee-name-<name>`, `attendee-email-<email>`, `where`, `reschedule-link`, `cancel` |
| Double booking | Booking the same time again returned **HTTP 409** `no_available_users_found_error`, as expected |

**Bug lead from the spike:** the confirmation page says *"We sent an email with a calendar invitation with the details to everyone"*, but this instance has no email server set up, so no email can have been sent. That's a misleading message for self-hosters. Check during step 7 whether anything warns the admin.

## 6. Repo setup findings (2026-11-16)

| Finding | Decision |
|---|---|
| In Cypress's built-in Electron browser, the booking page's `load` event never fires (timeout after 60s), although the server answers in under 0.1s and nothing loads from outside localhost | **Run all tests in Chrome** (`--browser chrome` in every npm script, and in CI). Chrome loads the page in about 1s, and it's what real guests use |
| The booking page throws **React error #418** (hydration mismatch: the server's HTML differs from what React renders in the browser). Browsers recover silently | `cypress/support/e2e.ts` ignores **only** this error and logs it; any other app error still fails the test. **Bug lead:** check whether it's caused by the server (UTC) and browser (Kolkata) time zones differing |
| Fresh start from an empty database (`npm run app:down && npm run app:up`) | About 11s locally, including 588 migrations and the seed |
| Versions | Cypress 16.2.1 (16.3.0 was only 6 days old), TypeScript 5.9.3 (TypeScript 7's rewritten compiler may not yet work with how Cypress compiles TypeScript), Node 24 LTS, luxon 3.7.2, zod 4.6.7. npm needed explicit approval for Cypress's install step (`allowScripts` in `package.json`) |

## 7. Booking-flow tests (2026-11-16)

TC-01, TC-03 and TC-06 are in `cypress/e2e/booking/`. All three passed **5 runs in a row with retries off** (`CAL_RETRIES=0`; about 13s of test time per run), with the browser in UTC as on CI.

> **Correction:** the first 5-run check used `--config retries=0`, which turned out **not** to override the `retries` object in `cypress.config.ts`, so retries were still on. All runs had passed on the first attempt anyway, but that wasn't proven. `CAL_RETRIES=0` now controls it (checked with a throwaway failing test: 2 attempts when unset, 1 when `0`), and the 5-run check was redone with it: 5 of 5 passed, with no retried attempts.

| Finding | Decision |
|---|---|
| Booking form: `input[name=name]`, `input[name=email]`, `textarea[name=notes]`, submit `confirm-book-button` | Used by `cy.confirmBooking`, which yields the booking uid from the `/booking/<uid>` confirmation URL |
| Time-zone picker: type a city into `timezone-select` and press Enter. The options are react-select items with no `role` (ids like `react-select-3-option-256`). The choice is saved as `localStorage["timeOption.preferredTimeZone"]` | `cy.chooseTimeZone` checks the saved value, so a wrong pick fails right there |
| Days have no date attribute, only their number; clicking one adds `date=yyyy-MM-dd` to the URL | `cy.openDay` moves to the right month, clicks the day, then **checks the URL date**, so it can't silently click the wrong day |
| Host login: `GET /api/auth/csrf`, then `POST /api/auth/callback/credentials` (form) | `cy.loginAsHost` uses it with `cy.session`; no login page |
| Host's list: `/bookings/upcoming` rows are `booking-item` with `data-booking-uid`, shown in the **host's** time zone and 12-hour clock ("Thu, 19 Nov" / "10:00am - 10:30am") | Tests find the exact booking by uid |
| Cal.com **holds a time for a few minutes** after a guest picks it (`SelectedSlots`), so one test's pick hid 10:00 from the next test | The `db:clearBookings` task (run before each booking test) empties bookings **and** holds in the local test database. Host and event are kept |
| This Mac's time zone is Kolkata, the same as the test guest's, so TC-03 couldn't tell the guest's *chosen* zone from the computer's | Every test script sets `TZ=UTC` (Chrome honours it; checked), so local runs match CI and TC-03 proves the chosen zone is used |
| Cancelling through `POST /api/cancel` needs a different CSRF token than login | Not used; clearing the test database is simpler and leaves nothing behind |

## 8. CI (2026-11-16)

**Green run:** [run 43840662287](https://github.com/Abh004/cal-qa/actions/runs/43840662287) on `072db50`. Both jobs passed: API tests in about 1 minute (4 passed, API-05 pending), booking-flow tests in about 3 minutes (3 passed).

| Finding | Decision |
|---|---|
| The first run's API job failed before any test ran: Cypress checks that `baseUrl` (localhost:3000) is up before running *any* spec, and that job starts no app | `CAL_BASE_URL=none` drops `baseUrl`; the API job and `npm run test:api` set it. Proven locally with the app stopped |
| Starting Cal.diy v6.2.0 (amd64) on a GitHub runner, including the 1.6 GB image download, migrations and seed | About 1 min 20 s |
| Username for the API tests | `CAL_API_USERNAME` repository secret (masked in logs), set from stdin |
| Supply chain | Every action pinned to a commit SHA (version in a comment); workflow token is read-only |

## 9. Deliberate red run (2026-11-16)

**Red run:** [run 43843717218](https://github.com/Abh004/cal-qa/actions/runs/43843717218) on the do-not-merge pull request [#1](https://github.com/Abh004/cal-qa/pull/1) (branch `demo/red-run`).

**What was broken:** no test code. The seed saves the host's **profile time zone as Europe/London** while their **working hours stay on America/New_York**, a realistic misconfiguration. Guests can still book, but the host's dashboard shows meetings at the wrong hour.

| Job / test | Result | Evidence |
|---|---|---|
| API tests | ✅ passed | Unaffected (hosted Cal.com API) |
| TC-01 smoke | ✅ passed | The guest side still works |
| TC-03 cross-time-zone | ❌ failed | Host's list: `Wed, 18 Nov 3:00pm - 3:30pm`; expected `10:00am - 10:30am` |
| TC-06 daylight saving | ❌ failed | Host's list: `Fri, 12 Mar 2027 3:00pm - 3:30pm`; expected `10:00am - 10:30am` |

The run uploaded `failure-evidence` (screenshots + Cal.diy logs) and `videos`. Auto-fix stays **off** for this pull request, since the failure is intended.

## 10. Bug hunt (2026-11-16)

Full list: [docs/bugs](bugs/README.md). The bug written up for the brief is **[BUG-002](bugs/BUG-002-slots-duration-not-validated.md) (S3 Medium)**.

**How it was found:**
- After the start-after-end case (BUG-001), I sent the slots API every parameter it accepts, with values a careless or out-of-date caller might send.
- `duration` stood out. On an event that only offers 30 minutes, sending `duration=60` returns half the times, and `duration=1440` returns none, both as a normal `200`.
- It reproduces on hosted cal.com (API v2) and on self-hosted Cal.diy v6.2.0 (its internal `slots.getSchedule`), which meets assumption A9.

**Why it was picked over the other leads:**
- It gives *wrong availability* with no error, and lost bookings caused this way are hard to notice.
- BUG-001 gives a wrong answer only to a caller who is already mistaken.
- RE-01 (the confirmation page says an email was sent when none could be) depends on how the instance is configured.
- RE-02 (React #418) has no visible effect.

**Checked, and found not to be bugs:**
- Cal.diy's own booking page ignores an unsupported `?duration=` and still books 30 minutes (checked in Chrome).
- The booking endpoint rejects a length the event doesn't offer (`400 Invalid event length`), so a wrong length can't reach the host's calendar. The harm is limited to what callers of the slots API show.

**Probing safely:**
- On hosted cal.com, only read-only `GET` requests were sent, one per value. Nothing was booked.
- Values that might be expensive (0, negative, 1-minute grids) were tried on the local instance first.

**Automation:** API-06 is a known-bug test, skipped like API-05. `INCLUDE_KNOWN_BUGS=true` shows both failing.


## 11. Final docs and fresh-clone check (2026-11-16)

- **Deliverables:**
  - [docs/test-plan.md](test-plan.md): the one-page test plan;
  - [docs/automate-next.md](automate-next.md): what to automate next and what to leave manual;
  - the final [README](../README.md): how to run it, why these 3 tests, why this suite exists alongside Cal.com's, and links to the green and red runs.
- **Fresh clone:** I cloned `main` (`c689228`) from GitHub into an empty folder and followed the README exactly:
  - `npm install`;
  - `npm run app:up`: up in 7 s, plus the seed;
  - `npm run test:e2e`: 3 of 3 passed;
  - `npm run test:api`: without a username, all 6 skipped as documented; with one, 4 passed and 2 pending;
  - `npm run app:down`.
- **What the fresh-clone check didn't cover:** the Docker image and the Cypress binary were already cached on this Mac. A first-time download is covered by CI instead, which pulls everything on every run (about 3 minutes in all).

## 12. TC-06 from both sides (2026-11-17)

**Why:** with a New York host, TC-06 tested only a clock change on the *host's* side. An India host (India hasn't changed its clocks since 1945) moves the clock change to the *guest's* side, and that's a different kind of bug. 10:00 India time is 04:30 UTC every day, but for a New York guest it falls either side of midnight depending on the season. So the meeting appears under a different date for the guest on one side of the change.

| Host day (10:00 India time) | UTC | New York guest sees |
|---|---|---|
| Fri Mar 12, 2027 (before the US change) | 04:30Z | **Thu Mar 11, 23:30**: the guest's previous day |
| Mon Mar 15, 2027 (after) | 04:30Z | Mon Mar 15, 00:30: the same day |
| Fri Nov 5, 2027 (before the November change) | 04:30Z | Fri Nov 5, 00:30: the same day |
| Mon Nov 8, 2027 (after) | 04:30Z | **Sun Nov 7, 23:30**: the guest's previous day |

**What changed:**
- The seed creates `qa-host-in`. The seed now has one `seedHost()` used for both hosts.
- `loginAsHost(host)` and `openBookingPage(event)` take an optional host or event, and still default to `qa-host`.
- New helpers: `sameDateIn`, `dayIn` and `offsetIn`.
- `GUEST_TIME_ZONE` is split into `KOLKATA` and `NEW_YORK`.
- TC-06 is now two tests: **A** (the host's clocks change, as before) and **B** (the guest's clocks change).

**How B works:**
- It finds the next clock change in the guest's zone.
- It books 10:00 India time on the weekdays either side, opening the calendar on the **guest's** date for each.
- It checks the guest's label, the confirmation, and the host's list, which must show `10:00am` on the host's own dates.
- Its preconditions hold in both directions: each booking is on its own side of the change, and the guest's date matches the host's on exactly one side. I checked the November case with the helpers, starting from June 2027.
- B has no 09:00 working-hours check, because India's hours never move. That check would also land on a different guest day.

**Results:**
- **Stability:** all 4 booking tests passed 5 runs in a row with retries off (about 19 s of test time per run).
- **B has teeth:** with `qa-host-in`'s profile time zone set to Europe/London (the red run's fault, applied in SQL and then reverted with the seed), B failed on the host's list (`Fri, 12 Mar 2027 4:30am - 5:00am`, expected `10:00am`) while A stayed green.
- **The red run is unchanged:** PR #1 stays on its old base.

