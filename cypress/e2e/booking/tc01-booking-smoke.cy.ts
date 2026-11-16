/**
 * TC-01 (smoke): a guest can book the host's event end to end on *this* deployment.
 * Cal.com has its own version of this test; ours exists because theirs never runs
 * against the image and settings we deploy. If this fails, nothing else matters.
 */
import { EVENT, HOST, newGuest } from "../../support/test-data";
import { confirmationText, nextWeekday, wallTimeToUtcIso } from "../../support/time";

describe("TC-01 booking smoke test", () => {
  beforeEach(() => cy.task("db:clearBookings"));

  it("books 10:00 on the next weekday and shows the right confirmation", () => {
    const guest = newGuest("smoke");
    const day = nextWeekday(HOST.timeZone); // at least 2 days ahead, clear of the 2-hour minimum notice
    const start = wallTimeToUtcIso(day, "10:00"); // 10:00 New York, as the exact UTC moment
    const expected = confirmationText(start, EVENT.lengthMinutes, HOST.timeZone);

    cy.openBookingPage();
    cy.chooseTimeZone("New York", HOST.timeZone); // guest in the host's own time zone
    cy.use24HourClock();
    cy.openDay(day);
    cy.pickTime(start).should("eq", "10:00");
    cy.confirmBooking(guest);

    cy.get('[data-testid="success-page"]').within(() => {
      cy.get('[data-testid="booking-title"]').should("contain.text", EVENT.title).and("contain.text", guest.name);
      cy.contains(expected.date).should("be.visible");
      cy.contains(expected.times).should("be.visible");
      cy.contains(`(${expected.zoneName})`).should("be.visible");
      cy.get(`[data-testid="attendee-email-${guest.email}"]`).should("be.visible");
      cy.get('[data-testid="booking-host-name"]').should("contain.text", HOST.name);
    });
  });
});
