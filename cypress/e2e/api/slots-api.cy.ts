/**
 * API tests: Cal.com's public slots API (GET /v2/slots), the endpoint behind
 * every public booking page. Read-only: nothing is booked or changed.
 * Test cases API-01 to API-05 in docs/decisions.md.
 */
import { DateTime } from "luxon";

import { ApiError, SlotsSuccess, apiConfig, expectShape, getSlots } from "../../support/cal-api";

/** A Monday-to-Wednesday range at least a week ahead, so every day is a weekday with times. */
function weekdayRange() {
  let monday = DateTime.utc().startOf("day").plus({ days: 7 });
  while (monday.weekday !== 1) monday = monday.plus({ days: 1 });
  const wednesday = monday.plus({ days: 2 });
  return { start: monday.toISODate()!, end: wednesday.toISODate()!, from: monday, until: wednesday.plus({ days: 1 }) };
}

const toInstants = (data: Record<string, { start: string }[]>) =>
  Object.values(data)
    .flat()
    .map((s) => DateTime.fromISO(s.start, { setZone: true }));

describe("Cal.com public slots API (GET /v2/slots)", () => {
  before(function () {
    if (apiConfig().username) return;
    if (Cypress.expose("requireApiConfig")) {
      throw new Error("CAL_API_USERNAME is not set. In CI, add it as a repository variable.");
    }
    cy.log("Skipped: set CAL_API_USERNAME to a cal.com username with a public event");
    this.skip();
  });

  it("API-01 returns well-formed times inside the requested range, in order, on the event's grid", () => {
    const range = weekdayRange();
    const { eventLengthMinutes } = apiConfig();

    getSlots({ start: range.start, end: range.end }).then((res) => {
      expect(res.status, "HTTP status").to.eq(200);
      expect(res.headers["content-type"], "content type").to.include("application/json");

      const body = expectShape(SlotsSuccess, res.body);
      const instants = toInstants(body.data);
      expect(instants.length, "number of times returned").to.be.greaterThan(0);

      instants.forEach((t) => {
        expect(t >= range.from && t < range.until, `${t.toISO()} is inside ${range.start}..${range.end} (UTC)`).to.eq(true);
        expect(t.offset, `${t.toISO()} is in UTC when no timeZone is given`).to.eq(0);
        expect(t.minute % eventLengthMinutes, `${t.toISO()} starts on the ${eventLengthMinutes}-minute grid`).to.eq(0);
      });

      // Times are in order, never closer together than the event length, and each
      // one is filed under the date it falls on.
      for (let i = 1; i < instants.length; i++) {
        const gap = instants[i].diff(instants[i - 1], "minutes").minutes;
        expect(gap, `gap between ${instants[i - 1].toISO()} and ${instants[i].toISO()}`).to.be.at.least(eventLengthMinutes);
      }
      Object.entries(body.data).forEach(([date, slots]) =>
        slots.forEach((s) => expect(s.start.slice(0, 10), `${s.start} is filed under ${date}`).to.eq(date))
      );
    });
  });

  it("API-02 returns the same moments in the guest's time zone when timeZone is given", () => {
    const range = weekdayRange();
    const zone = "Asia/Kolkata";

    getSlots({ start: range.start, end: range.end }).then((utcRes) => {
      const utc = toInstants(expectShape(SlotsSuccess, utcRes.body).data);

      getSlots({ start: range.start, end: range.end, timeZone: zone }).then((res) => {
        expect(res.status, "HTTP status").to.eq(200);
        const body = expectShape(SlotsSuccess, res.body);

        Object.entries(body.data).forEach(([date, slots]) =>
          slots.forEach((s) => {
            expect(s.start, "shown with the Kolkata offset").to.match(/\+05:30$/);
            expect(s.start.slice(0, 10), `${s.start} is filed under its Kolkata date`).to.eq(date);
          })
        );

        // Same moments, only written differently. (The event's working hours are far from
        // midnight in both zones, so reading the dates in UTC or Kolkata can't change the set.)
        const asUtc = (list: DateTime[]) => list.map((t) => t.toUTC().toISO()).sort();
        expect(asUtc(toInstants(body.data)), "the same moments as the UTC response").to.deep.eq(asUtc(utc));
      });
    });
  });

  it("API-03 answers 404 with a clear error for an event that doesn't exist", () => {
    const range = weekdayRange();
    getSlots({ start: range.start, end: range.end, eventTypeSlug: `no-such-event-${Date.now()}` }).then((res) => {
      expect(res.status, "HTTP status").to.eq(404);
      const body = expectShape(ApiError, res.body);
      expect(body.error.code).to.eq("NotFoundException");
      expect(body.error.message.toLowerCase()).to.include("not found");
    });
  });

  it("API-04 answers 400 naming the bad field, for a malformed date or an unknown time zone", () => {
    const range = weekdayRange();

    getSlots({ start: "not-a-date", end: range.end }).then((res) => {
      expect(res.status, "HTTP status for start=not-a-date").to.eq(400);
      const body = expectShape(ApiError, res.body);
      expect(body.error.code).to.eq("BadRequestException");
      expect(body.error.message, "message names the field").to.match(/\bstart\b/);
    });

    getSlots({ start: range.start, end: range.end, timeZone: "Mars/Phobos" }).then((res) => {
      expect(res.status, "HTTP status for timeZone=Mars/Phobos").to.eq(400);
      const body = expectShape(ApiError, res.body);
      expect(body.error.code).to.eq("BadRequestException");
      expect(body.error.message, "message names the field").to.match(/timeZone/);
    });
  });

  /**
   * Known bug BUG-001: when start is after end, the API answers 200 with no times
   * instead of rejecting the request, so a caller with a date mix-up sees
   * "no availability" rather than an error. Skipped in normal runs so the suite
   * stays green; run with INCLUDE_KNOWN_BUGS=true to see it fail until it's fixed.
   */
  const knownBug = Cypress.expose("includeKnownBugs") ? it : it.skip;
  knownBug("API-05 rejects a range whose start is after its end (known bug BUG-001)", () => {
    const range = weekdayRange();
    getSlots({ start: range.end, end: range.start }).then((res) => {
      expect(res.status, `HTTP status for start=${range.end} end=${range.start}`).to.eq(400);
      const body = expectShape(ApiError, res.body);
      expect(body.error.message, "message explains the range problem").to.match(/start|end/i);
    });
  });
});
