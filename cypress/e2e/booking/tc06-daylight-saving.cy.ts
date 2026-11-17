/**
 * TC-06 (edge case): booking across a daylight-saving change, from both sides.
 *
 * A. The host's clocks change. A New York host, a Kolkata guest. The same 10:00 New York
 *    meeting must show one hour apart in Kolkata on either side of the change (for March
 *    14, 2027: 20:30 on Friday, 19:30 on Monday), while the host still sees 10:00 and
 *    working hours still start at 09:00 New York.
 *
 * B. The guest's clocks change. An India host (India never changes its clocks), a New
 *    York guest. The same 10:00 India meeting is at the same UTC moment every day, but
 *    the guest's clock moves by an hour, and that pushes it across midnight: for March
 *    2027, Friday's meeting is Thursday 23:30 for the guest, Monday's is Monday 00:30.
 *    So the guest must find it under a different calendar date on one side of the change.
 *
 * Upstream only checks this maths in isolation. Twice a year, getting it wrong puts every
 * cross-zone meeting off by an hour, or on the wrong day.
 */
import type { DateTime } from "luxon";

import { EVENT, EVENT_IN, HOST, HOST_IN, KOLKATA, NEW_YORK, newGuest } from "../../support/test-data";
import {
  clockTimeIn,
  confirmationText,
  dateIn,
  dayIn,
  hostListText,
  nextOffsetChange,
  offsetIn,
  sameDateIn,
  wallTimeToUtcIso,
} from "../../support/time";

describe("TC-06 booking across a daylight-saving change", () => {
  beforeEach(() => cy.task("db:clearBookings"));

  it("A, host's clocks change: keeps 10:00 New York correct for a Kolkata guest on both sides", () => {
    const change = nextOffsetChange(HOST.timeZone); // found from today, so the test keeps working every year
    const shiftMinutes = change.offsetAfterMinutes - change.offsetBeforeMinutes; // +60 in March, -60 in November
    const days = [change.weekdayBefore, change.weekdayAfter];
    const starts = days.map((d) => wallTimeToUtcIso(d, "10:00"));
    const kolkataLabels = starts.map((s) => clockTimeIn(s, KOLKATA));
    cy.log(`Clock change ${change.changeDay.toISODate()}: booking ${days.map((d) => d.toISODate()).join(" and ")}`);

    // Preconditions on our own maths: the meeting is the same New York time but a different
    // UTC moment on each side, and it lands on the same calendar day in Kolkata.
    expect(Math.abs(shiftMinutes), "size of the clock change").to.eq(60);
    starts.forEach((s, i) => expect(dateIn(s, KOLKATA), "Kolkata date").to.eq(days[i].toISODate()));
    expect(kolkataLabels[0], "Kolkata times differ across the change").not.to.eq(kolkataLabels[1]);

    const uids: string[] = [];
    days.forEach((day: DateTime, i) => {
      const start = starts[i];
      const guestView = confirmationText(start, EVENT.lengthMinutes, KOLKATA);

      cy.openBookingPage();
      cy.chooseTimeZone("Kolkata", KOLKATA);
      cy.use24HourClock();
      cy.openDay(day);

      // Working hours follow New York's clock on this side of the change: 09:00 is offered, 08:30 isn't.
      cy.get(`[data-testid="time"][data-time="${wallTimeToUtcIso(day, "09:00")}"]`).should("exist");
      cy.get(`[data-testid="time"][data-time="${wallTimeToUtcIso(day, "08:30")}"]`).should("not.exist");

      cy.pickTime(start).should("eq", kolkataLabels[i]);
      cy.confirmBooking(newGuest(`dst${i}`)).then((uid) => uids.push(uid));

      cy.get('[data-testid="success-page"]').within(() => {
        cy.contains(guestView.date).should("be.visible");
        cy.contains(guestView.times).should("be.visible");
        cy.contains(`(${guestView.zoneName})`).should("be.visible");
      });
    });

    // Host side: both bookings at 10:00 New York, each on its own date.
    cy.loginAsHost();
    cy.visit("/bookings/upcoming");
    cy.then(() =>
      uids.forEach((uid, i) => {
        const hostView = hostListText(starts[i], EVENT.lengthMinutes, HOST.timeZone);
        cy.get(`[data-testid="booking-item"][data-booking-uid="${uid}"]`, { timeout: 20_000 })
          .should("contain.text", hostView.date)
          .and("contain.text", "10:00am - 10:30am");
      })
    );
  });

  it("B, guest's clocks change: keeps 10:00 India correct for a New York guest, under the guest's own date", () => {
    const change = nextOffsetChange(NEW_YORK); // the guest's zone changes; India's never does
    const hostDays = [change.weekdayBefore, change.weekdayAfter].map((d) => sameDateIn(d, HOST_IN.timeZone));
    const starts = hostDays.map((d) => wallTimeToUtcIso(d, "10:00"));
    const guestDays = starts.map((s) => dayIn(s, NEW_YORK));
    const guestLabels = starts.map((s) => clockTimeIn(s, NEW_YORK));
    cy.log(
      `Guest's clock change ${change.changeDay.toISODate()}: host books ${hostDays.map((d) => d.toISODate()).join(" and ")}, ` +
        `guest sees ${starts.map((s, i) => `${guestDays[i].toISODate()} ${guestLabels[i]}`).join(" and ")}`
    );

    // Preconditions on our own maths: each meeting is on the guest's clock from its own side
    // of the change, and the guest's date matches the host's on exactly one side.
    starts.forEach((s, i) => {
      expect(offsetIn(s, NEW_YORK), `guest's UTC offset for booking ${i + 1}`).to.eq(i === 0 ? change.offsetBeforeMinutes : change.offsetAfterMinutes);
    });
    const sameDate = starts.map((s, i) => dateIn(s, NEW_YORK) === hostDays[i].toISODate());
    expect(sameDate.filter(Boolean), "sides where guest and host share a date").to.have.length(1);

    const uids: string[] = [];
    starts.forEach((start, i) => {
      const guestView = confirmationText(start, EVENT_IN.lengthMinutes, NEW_YORK);

      cy.openBookingPage(EVENT_IN);
      cy.chooseTimeZone("New York", NEW_YORK);
      cy.use24HourClock();
      cy.openDay(guestDays[i]); // the guest's own date, which isn't always the host's
      cy.pickTime(start).should("eq", guestLabels[i]);
      cy.confirmBooking(newGuest(`dstg${i}`)).then((uid) => uids.push(uid));

      cy.get('[data-testid="success-page"]').within(() => {
        cy.contains(guestView.date).should("be.visible");
        cy.contains(guestView.times).should("be.visible");
        cy.contains(`(${guestView.zoneName})`).should("be.visible");
      });
    });

    // Host side: both bookings at 10:00 India time, each on the host's own date.
    cy.loginAsHost(HOST_IN);
    cy.visit("/bookings/upcoming");
    cy.then(() =>
      uids.forEach((uid, i) => {
        const hostView = hostListText(starts[i], EVENT_IN.lengthMinutes, HOST_IN.timeZone);
        cy.get(`[data-testid="booking-item"][data-booking-uid="${uid}"]`, { timeout: 20_000 })
          .should("contain.text", hostView.date)
          .and("contain.text", "10:00am - 10:30am");
      })
    );
  });
});
