/**
 * TC-03 (regression): a guest in Kolkata and a host in New York see the same moment.
 * Cal.com tests time-zone maths in isolation; nothing upstream checks, end to end,
 * that the guest's screen, the guest's confirmation and the host's bookings list agree.
 * If they don't, someone joins the meeting at the wrong time and nothing errors.
 */
import { EVENT, KOLKATA, HOST, newGuest } from "../../support/test-data";
import { clockTimeIn, confirmationText, dateIn, hostListText, nextWeekday, wallTimeToUtcIso } from "../../support/time";

describe("TC-03 guest and host in different time zones", () => {
  beforeEach(() => cy.task("db:clearBookings"));

  it("a Kolkata guest booking 10:00 New York sees it in Kolkata time, and the host sees 10:00", () => {
    const guest = newGuest("tz");
    const day = nextWeekday(HOST.timeZone);
    const start = wallTimeToUtcIso(day, "10:00"); // the moment both people must agree on
    const guestView = confirmationText(start, EVENT.lengthMinutes, KOLKATA);
    const hostView = hostListText(start, EVENT.lengthMinutes, HOST.timeZone);

    // Precondition: 10:00 New York falls on the same calendar day in Kolkata (it's 19:30 or 20:30).
    expect(dateIn(start, KOLKATA), "Kolkata date of the booking").to.eq(day.toISODate());

    // Guest side: pick Kolkata, then pick the moment that is 10:00 in New York.
    cy.openBookingPage();
    cy.chooseTimeZone("Kolkata", KOLKATA);
    cy.use24HourClock();
    cy.openDay(day);
    cy.pickTime(start).should("eq", clockTimeIn(start, KOLKATA));
    const bookingUid = cy.confirmBooking(guest);

    cy.get('[data-testid="success-page"]').within(() => {
      cy.contains(guestView.date).should("be.visible");
      cy.contains(guestView.times).should("be.visible");
      cy.contains(`(${guestView.zoneName})`).should("be.visible");
    });

    // Host side: the same booking, in the host's own time zone.
    bookingUid.then((uid) => {
      cy.loginAsHost();
      cy.visit("/bookings/upcoming");
      cy.get(`[data-testid="booking-item"][data-booking-uid="${uid}"]`, { timeout: 20_000 })
        .should("contain.text", hostView.date)
        .and("contain.text", hostView.times)
        .and("contain.text", guest.name);
    });
  });
});
