# BUG-002: Slots API reshapes a fixed-length event's availability around any `duration` it's sent

| | |
|---|---|
| **Severity** | S3 (Medium): see [why](#severity-s3-medium-and-why) |
| **Component** | Availability / slots: public API v2 `GET /v2/slots` (hosted cal.com) and `slots.getSchedule` (self-hosted Cal.diy) |
| **Found in** | Hosted cal.com, API v2 with `cal-api-version: 2024-09-04` (checked 2026-11-16); self-hosted Cal.diy v6.2.0 (`calcom/cal.com:v6.2.0-arm`) |
| **Reproducible** | Every time, on both |
| **Regression test** | `API-06` in [`cypress/e2e/api/slots-api.cy.ts`](../../cypress/e2e/api/slots-api.cy.ts). It's skipped in normal runs and fails today with `INCLUDE_KNOWN_BUGS=true` |

## Summary

`duration` is meant for events that offer **several** lengths (for example 15, 30 or 60 minutes). On an event with **one fixed length**, the slots API should ignore it or reject it. Instead, it takes any value it's sent and lays out the host's day on that grid:

- It hides half the real times.
- It offers start times the event never offers, which can then fail at booking.
- It can report a fully free host as having **no times at all**.

The response is a normal `200`, so a client has no way to tell that the answer is wrong.

## Steps to reproduce (hosted cal.com, read-only)

1. Use any cal.com user whose public event has a single fixed length. The event used here was `30min`: 30 minutes, with no other lengths offered. `GET /v2/event-types?username=<username>` confirms this: `lengthInMinutes: 30`, and no `lengthInMinutesOptions`.
2. Request a weekday's slots without `duration`:
   ```bash
   curl -H 'cal-api-version: 2024-09-04' \
     'https://api.cal.com/v2/slots?username=<username>&eventTypeSlug=30min&start=2026-11-23&end=2026-11-23&timeZone=Asia/Kolkata'
   ```
3. Repeat the same request with `&duration=60`, then `&duration=1`, then `&duration=1440`.

## Expected

The event is always 30 minutes long, so `duration` shouldn't change which times are offered. Either outcome would be correct:

- The API ignores it and returns the same times as step 2.
- The API returns `400` with a message such as "duration must be one of: 30".

## Actual

Each request returns `200 success`, with a different set of times:

| Request | Times returned | First … last |
|---|---|---|
| no `duration` (step 2) | **16** | 09:00, 09:30, 10:00 … 16:30 |
| `duration=30` | 16 | same as step 2 |
| `duration=15` | 32 | 09:00, 09:15, 09:30 … 16:45 |
| `duration=60` | **8** | 09:00, 10:00, 11:00 … 16:00 (09:30, 10:30 … 16:30 have gone) |
| `duration=1` | **480** | 09:00, 09:01, 09:02 … 16:59 |
| `duration=1440` | **0** | `"data": {}`: the host appears fully booked |

Self-hosted Cal.diy v6.2.0 behaves the same way. Its internal slots endpoint, `GET /api/trpc/slots/getSchedule`, also accepts `duration`. Sending it `"duration":"60"` returns 8 times instead of 16, `"1"` returns 480, and `"1440"` returns none.

**Times from these responses can't always be booked.** On the self-hosted instance, booking one of the extra times at the length the API was asked for fails *after* the guest has filled in the form:

```text
POST /api/book/event   start 14:07Z, end 14:14Z (a 7-minute time from duration=7)
→ 400 {"message":"Invalid event length"}
```

Cal.diy's own booking page is **not** affected. Opening `/qa-host/30min?duration=60` or `?duration=7` still shows the normal 30-minute times and books 30 minutes. I checked this in Chrome with a throwaway Cypress script. So the guests at risk are those using anything built on the API.

## Who it hurts, and how

Anyone whose booking screen calls the slots API with a `duration` is affected: Cal.com Platform customers, custom booking pages, and integrations. Here's a realistic way to get there:

1. A host's event used to offer 30 or 60 minutes, and a partner's booking widget sends `duration=60`.
2. The host makes the event 30 minutes only.
3. The widget keeps working, but silently shows half the host's times. With a larger value, it shows none.

Guests see a busy host and leave. **Lost bookings like these produce no error and no log entry.** The host is the one person who could notice, and only by comparing the widget with their own booking page.

## Severity: S3 (Medium), and why

| Scale used | |
|---|---|
| S1 Critical | Data loss or security; core flow down for everyone |
| S2 High | Core flow broken or wrong for many users, no reasonable workaround |
| **S3 Medium** | **Wrong results for a subset of users; a workaround exists** |
| S4 Low | Cosmetic, or an unhelpful message with no wrong result |

**Not lower than S3:** the result is *wrong availability*, and it's wrong silently. A booking app can't get much worse than that: hiding real times loses bookings, and offering invalid ones produces failed bookings. Neither shows up as an error anywhere.

**Not higher than S3:**
- Cal.com's own booking pages aren't affected.
- The API is only wrong when a caller sends `duration` for a fixed-length event.
- Callers have a simple workaround: leave `duration` out for those events.
- Nothing is double-booked or lost on the host's side.

**Priority** is the product owner's call. I'd suggest P2: the fix is small and low-risk (see below), and API users can't easily notice this problem for themselves.

## Likely fix

When the event type has a fixed length, accept `duration` only if it equals that length. When the event offers several lengths, accept only values from that list. For anything else, return `400` naming `duration` and the allowed values. (Silently ignoring the value would also be correct, but it would hide the caller's mistake.)

Dynamic group links, which legitimately accept any `duration`, would keep their current behaviour.

## Evidence

- The requests and responses above, captured with `curl` on 2026-11-16.
- A throwaway Cypress run against the self-hosted booking page with `?duration=60` and `?duration=7`, which showed the UI isn't affected.
- `API-06` reproduces it automatically. Run it with:
  ```bash
  CAL_API_USERNAME=<username> INCLUDE_KNOWN_BUGS=true npm run test:api
  ```
