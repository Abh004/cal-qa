# Bugs and rough edges

These were found while building the tests (2026-11-16). **BUG-002 is the full write-up for the brief.**

| ID | Title | Where | Severity | Status |
|---|---|---|---|---|
| [BUG-002](BUG-002-slots-duration-not-validated.md) | Slots API reshapes a fixed-length event's availability around any `duration` it's sent: it can hide half the times, or all of them | Hosted cal.com API v2 and self-hosted Cal.diy v6.2.0 | **S3 Medium** | Reproduced on both. Known-bug test API-06 |
| [BUG-001](BUG-001-slots-start-after-end.md) | Slots API answers "no times" instead of an error when `start` is after `end` | Hosted cal.com API v2 | S4 Low | Reproduced. Known-bug test API-05 |
| RE-01 | The confirmation page tells the guest *"We sent an email with a calendar invitation with the details to everyone"*. With no email server set up, every send fails (`spawn /usr/sbin/sendmail ENOENT` in the logs), and nothing tells the guest or the admin | Self-hosted Cal.diy v6.2.0 with no email settings | S3 for self-hosters (guests believe an invite is on its way) | Rough edge. It depends on configuration, so it isn't logged as a product bug. Handled in this repo by keeping emails out of scope (A7) |
| RE-02 | The booking page throws React error #418, a hydration mismatch: the server's HTML differs from the browser's first render. Browsers recover, and nothing visible breaks | Self-hosted Cal.diy v6.2.0 | S4 | Cause not confirmed. The tests ignore exactly this error ([`cypress/support/e2e.ts`](../../cypress/support/e2e.ts)) |

## How these are written

Each bug report includes:
- steps anyone can run;
- the expected result, with a reason for that expectation;
- the actual result, with the exact responses.

Severity uses the four-level scale in BUG-002, and each report explains why its bug isn't one level higher or one level lower. Priority is left to the product owner.

## Known-bug tests

Every confirmed bug gets an automated test that is skipped in normal runs, so `main` stays green and the test shows as pending:

```bash
INCLUDE_KNOWN_BUGS=true npm run test:api
```

Run that way, the test fails until the bug is fixed. Once it passes, remove the skip.
