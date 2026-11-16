# BUG-001: Slots API answers "no times" instead of an error when `start` is after `end`

| | |
|---|---|
| **Severity** | S4 (Low) |
| **Component** | Public API v2 `GET /v2/slots` (hosted cal.com) |
| **Found in** | Hosted cal.com, `cal-api-version: 2024-09-04` (checked 2026-11-16) |
| **Reproducible** | Every time |
| **Regression test** | `API-05` in [`cypress/e2e/api/slots-api.cy.ts`](../../cypress/e2e/api/slots-api.cy.ts). It's skipped in normal runs and fails today with `INCLUDE_KNOWN_BUGS=true` |

## Steps to reproduce

```bash
curl -H 'cal-api-version: 2024-09-04' \
  'https://api.cal.com/v2/slots?username=<username>&eventTypeSlug=30min&start=2026-11-25&end=2026-11-23'
```

## Expected

`400`, with a message saying that `start` must not be after `end`. The same endpoint already returns a `400` naming the field for a malformed date or an unknown time zone (API-04).

## Actual

`200 {"data":{},"status":"success"}`. The response is identical to a real "this host has no free times" answer.

## Severity: S4 (Low), and why

- The caller has made a mistake: their dates are the wrong way round.
- No real availability is hidden, and Cal.com's own pages never send a range like this.

The harm is in debugging time, not lost bookings. A client with swapped dates shows "fully booked" and nothing points to the cause.

It's worth fixing alongside [BUG-002](BUG-002-slots-duration-not-validated.md), because both come from the slots API accepting input it should reject.
