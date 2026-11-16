/**
 * TC-06 (edge case): booking across the host's next daylight-saving change.
 * New York shifts its clocks; Kolkata doesn't. So the same 10:00 New York meeting must
 * show one hour apart in Kolkata on either side of the change (for March 14, 2027:
 * 20:30 on Friday, 19:30 on Monday), while the host still sees 10:00 on both days and
 * working hours still start at 09:00 New York. Upstream only checks this maths in
 * isolation. Twice a year, getting it wrong puts every cross-zone meeting off by an hour.
 */
import type { DateTime } from "luxon";

import { EVENT, GUEST_TIME_ZONE, HOST, newGuest } from "../../support/test-data";
import { clockTimeIn, confirmationText, dateIn, hostListText, nextOffsetChange, wallTimeToUtcIso } from "../../support/time";

describe("TC-06 booking across a daylight-saving change", () => {
  beforeEach(() => cy.task("db:clearBookings"));

  it("keeps 10:00 New York correct for a Kolkata guest on both sides of the clock change", () => {
    const change = nextOffsetChange(HOST.timeZone); // found from today, so the test keeps working every year
    const shiftMinutes = change.offsetAfterMinutes - change.offsetBeforeMinutes; // +60 in March, -60 in November
    const days = [change.weekdayBefore, change.weekdayAfter];
    const starts = days.map((d) => wallTimeToUtcIso(d, "10:00"));
    const kolkataLabels = starts.map((s) => clockTimeIn(s, GUEST_TIME_ZONE));
    cy.log(`Clock change ${change.changeDay.toISODate()}: booking ${days.map((d) => d.toISODate()).join(" and ")}`);

    // Preconditions on our own maths: the meeting is the same New York time but a different
    // UTC moment on each side, and it lands on the same calendar day in Kolkata.
    expect(Math.abs(shiftMinutes), "size of the clock change").to.eq(60);
    starts.forEach((s, i) => expect(dateIn(s, GUEST_TIME_ZONE), "Kolkata date").to.eq(days[i].toISODate()));
    expect(kolkataLabels[0], "Kolkata times differ across the change").not.to.eq(kolkataLabels[1]);

    const uids: string[] = [];
    days.forEach((day: DateTime, i) => {
      const start = starts[i];
      const guestView = confirmationText(start, EVENT.lengthMinutes, GUEST_TIME_ZONE);

      cy.openBookingPage();
      cy.chooseTimeZone("Kolkata", GUEST_TIME_ZONE);
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
});
