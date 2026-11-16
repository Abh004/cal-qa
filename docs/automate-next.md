# What I'd automate next, and what I'd leave manual

**The rule:** automate a check when it's repeatable and its expected answer can be calculated in advance, and when a miss would be silent or expensive. Keep it manual when the judgment is the point (does this look right, does this make sense), or when the setup would cost more than the test would ever catch.

## Automate next, in this order

| # | What | Why next | How |
|---|---|---|---|
| 1 | **TC-04: two guests submitting the same time at once** | A double booking is the second-worst silent failure, and timing bugs like this can't be found by hand. TC-02 (one after the other) is covered upstream; truly simultaneous requests aren't | A Cypress task fires several `POST /api/book/event` requests in parallel from Node (`Promise.all`). Pass when exactly one is accepted, the rest get `409`, and the database holds one booking |
| 2 | **TC-10: email and calendar invite, using Mailpit** | Today the invite is never checked (assumption A7). A wrong time zone in the invite is exactly the wrong-hour failure TC-03 guards against. This would also catch RE-01 (an email reported as sent that wasn't) | Add Mailpit to `docker/compose.yml` and point Cal.diy's SMTP settings at it. Read the messages through Mailpit's API and check the `.ics` file's `DTSTART` against the booked UTC moment |
| 3 | **TC-07: minimum notice, buffers, how far ahead people can book** | Offering a time the host has ruled out is wrong availability. Cal.com's own browser test for booking limits is switched off (`test.fixme`) | Seed variants of the event, and assert on `data-time` attributes only (no booking needed) |
| 4 | **Slots API contract checks for every parameter** | BUG-002 was found by probing one parameter by hand. Checking each parameter's valid values and boundaries would find the next one automatically | A table of cases fed into one API spec, all compared against the response with no optional parameters set |
| 5 | **TC-01 at phone width (375 px)** | Many guests book on their phones. The layout changes, and so can the selectors | The same spec run with a second viewport setting in CI, against the same instance |
| 6 | **Scheduled upgrade check** | Today the upgrade check runs only when someone starts it by hand | A weekly `schedule:` trigger that runs the suite against the newest Cal.diy tag and opens an issue when it fails |
| 7 | **TC-08: form validation** | Errors here are loud and cheap to spot, so it ranks lower. Non-Latin names are still worth a regression test | Table-driven inputs; assert the error message and that no booking was created |
| 8 | **Automated accessibility scan of the booking page** | Catches missing labels and contrast regressions cheaply on every run | `cypress-axe` on the booking page and the form, failing only on serious issues |

## Leave manual

| What | Why it stays manual |
|---|---|
| **Exploratory testing**, like the session that found BUG-002 | Finding a new bug means asking questions nobody has written down yet. Each confirmed bug *becomes* an automated test (API-05, API-06), but the search itself is judgment |
| **Does it look and read right?** Layout, wording, whether an error message makes sense to a guest | A script can tell that text is present, not whether it's clear. Screenshot-comparison tools would fail on every harmless design change in a fast-moving app |
| **Real Google and Outlook calendar connections** | Needs real accounts, OAuth consent screens and 2FA, plus third-party rate limits. That's slow, flaky and partly impossible to automate safely. One manual pass per upgrade, using a test account, checks it end to end |
| **How emails look in real mail apps** (Gmail, Outlook, Apple Mail) | Mailpit can check the content (item 2 above). Rendering differences between mail apps need human eyes, and only when the email template changes |
| **Screen-reader experience** | An automated scan (item 8 above) catches the mechanical problems. Whether booking is actually usable with VoiceOver or NVDA needs a person to try it |
| **The first-run setup page and admin settings** | Used once per installation, with low harm if broken (an admin is watching when it happens). A checklist step in the upgrade runbook is enough |
| **Payments, teams, routing forms** | Out of scope for this deployment. If they come into use, each needs a plan of its own before any automation |

## What I'd *not* add

**More copies of Cal.com's own tests** (TC-02, TC-05, TC-09 and its unit-tested maths). Running them again here would double the maintenance for very little extra protection. The exception is the smoke test, because Cal.com never runs its tests against *our* deployment.
