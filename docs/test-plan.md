# Test plan: Cal.com booking flow

**Under test:** the public booking flow of Cal.com, through the open-source edition **Cal.diy v6.2.0** run by a team that self-hosts it, plus Cal.com's public slots API.
**Purpose:** decide whether a new Cal.diy version is safe to deploy. If the suite is green, upgrade; if it's red, don't.
**Fixed test data:** host `qa-host` (New York, Mon–Fri 09:00–17:00), one 30-minute event, a fresh database for every run. The guest is in Kolkata unless a test says otherwise.

## What the flow must do

1. **Offer only real availability:** times when the host is working and free, respecting minimum notice, buffers and limits.
2. **Show every time correctly in the guest's own time zone,** including in the weeks when clocks change.
3. **Let a guest book** with a name and email, and confirm the right event, date, time and time zone.
4. **Never double-book:** a booked time disappears, and two guests can't both get it.
5. **Record the same moment for the host** as the guest saw, and tell both of them.
6. **Let either side reschedule or cancel,** which frees the old time.

## The 10 test cases that matter most

Ordered by how badly a user is hurt if the case breaks. The last column says how each one is covered.

| # | Test case | Pass when | Covered by |
|---|---|---|---|
| TC-01 | Guest books 10:00 on the next weekday, in the host's time zone | Confirmation shows the right event, date, 10:00–10:30, time zone and guest | **Automated: smoke** |
| TC-02 | Book a time, then open the same day as a new visitor | That time is gone; the times either side remain | Cal.com's own tests |
| TC-03 | A Kolkata guest books 10:00 New York; the host checks their bookings | The guest sees the calculated Kolkata time; the host sees 10:00 for the same booking | **Automated: regression** |
| TC-04 | Two guests submit the same time at the same moment | Exactly one booking; the other guest gets a clear error | Next to automate |
| TC-05 | Weekends, outside 9–5, and days the host has blocked | Nothing is offered outside the host's availability | Cal.com's own tests |
| TC-06 | The same booking on the weekdays before and after the next US clock change | The host still sees 10:00, the first time offered is still 09:00, and the guest's time moves by exactly one hour | **Automated: edge case** |
| TC-07 | Minimum notice, buffers, how far ahead people can book | Times that break these rules aren't offered | Next to automate |
| TC-08 | Blank name, malformed email, very long or non-Latin name | Clear errors, no booking; unusual but valid names still work | Next to automate |
| TC-09 | Reschedule, then cancel, through the booking's link | The old time is freed and the new one blocked; a cancelled time comes back | Cal.com's own tests |
| TC-10 | Confirmation email and calendar invite | Both show the right time and time zone | Manual for now |

**Also automated:** 6 API checks on `GET /v2/slots`. These cover the response shape, time-zone conversion and error handling, plus two tests for known bugs.

## Why these 10

The ranking rule is: **a failure nobody notices is worse than one everybody notices.** A broken booking page (TC-01) is the worst case, but it gets noticed and fixed within hours. A meeting at the wrong hour (TC-03, TC-06) or a double booking (TC-02, TC-04) looks like a success to everyone until two people miss each other. So those come straight after the smoke test, ahead of loud failures like form errors (TC-08).

The second filter is **reach**:
- Time zones affect every guest in another country.
- Clock changes affect every booking during two weeks of the year.
- Payments, teams, routing forms and calendar connections were left out. A basic self-hosted setup doesn't use them, and each would need a plan of its own.

**What Cal.com already covers:** Cal.com's own suite tests the logic in TC-02, TC-05 and TC-09 thoroughly, so repeating it wouldn't catch anything new. This suite spends its effort on two things Cal.com doesn't do: running against **the image we actually deploy**, and following each booking **end to end across time zones**. Cal.com checks time-zone maths only in isolated unit tests.

## How it's run, and what counts as done

- Every push and pull request runs both jobs in GitHub Actions: API tests, and booking-flow tests in Chrome against the pinned Cal.diy image.
- Running the workflow by hand with a newer image tag is the upgrade check.
- **Exit:** every test passes. Tests for known bugs are reported as pending.
- CI retries a failed test once. A pass on that retry still shows the failed first attempt in the run log, so flakiness is visible and gets looked at.
- Failures upload screenshots, video and the app's logs.
