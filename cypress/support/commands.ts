import type { DateTime } from "luxon";

import { EVENT, HOST } from "./test-data";

/**
 * Custom commands for the public booking page and the host's dashboard.
 * Selectors are Cal.diy's own data-testid attributes (confirmed in v6.2.0).
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Logs in as qa-host through the API (no login page), cached across tests with cy.session. */
      loginAsHost(): Chainable<void>;
      /** Opens the seeded event's public booking page. */
      openBookingPage(): Chainable<void>;
      /** Picks the guest's time zone in the booking page's picker, by typing a city name. */
      chooseTimeZone(city: string, ianaZone: string): Chainable<void>;
      /** Switches the booking page to the 24-hour clock, so labels read "20:30". */
      use24HourClock(): Chainable<void>;
      /** Moves the calendar to the day's month and clicks the day. */
      openDay(day: DateTime): Chainable<void>;
      /** Clicks the time button for an exact UTC moment and yields its visible label. */
      pickTime(utcIso: string): Chainable<string>;
      /** Fills the booking form, confirms, waits for the confirmation page and yields the booking uid. */
      confirmBooking(guest: { name: string; email: string }): Chainable<string>;
    }
  }
}

Cypress.Commands.add("loginAsHost", () => {
  cy.session(
    HOST.username,
    () => {
      cy.request("/api/auth/csrf").then(({ body }) =>
        cy.request({
          method: "POST",
          url: "/api/auth/callback/credentials",
          form: true,
          body: { csrfToken: body.csrfToken, email: HOST.email, password: HOST.password, callbackUrl: "/", json: "true" },
        })
      );
    },
    {
      validate: () => {
        cy.request("/api/auth/session").its("body.user.username").should("eq", HOST.username);
      },
    }
  );
});

Cypress.Commands.add("openBookingPage", () => {
  cy.visit(EVENT.path);
  cy.get('[data-testid="event-title"]').should("contain.text", EVENT.title);
  // The calendar has loaded its times once at least one day is clickable.
  cy.get('[data-testid="day"][data-disabled="false"]').should("exist");
});

Cypress.Commands.add("chooseTimeZone", (city, ianaZone) => {
  cy.get('[data-testid="timezone-select"]').click();
  cy.focused().type(city);
  // react-select options have no role attribute; their ids look like "react-select-3-option-256".
  cy.get('[id*="-option-"]').should("have.length.at.least", 1).first().should("contain.text", city);
  cy.focused().type("{enter}");
  cy.window().its("localStorage").invoke("getItem", "timeOption.preferredTimeZone").should("eq", ianaZone);
});

Cypress.Commands.add("use24HourClock", () => {
  cy.get('[data-testid="toggle-group-item-HH:mm"]').click();
  cy.window().its("localStorage").invoke("getItem", "timeOption.is24hClock").should("eq", "true");
});

Cypress.Commands.add("openDay", (day) => {
  const monthName = day.toFormat("LLLL");
  const year = day.toFormat("yyyy");
  const goToMonth = (clicksLeft: number): void => {
    cy.get('[data-testid="selected-month-label"]')
      .invoke("text")
      .then((label) => {
        if (label.includes(monthName) && label.includes(year)) return;
        if (clicksLeft === 0) throw new Error(`Calendar never reached ${monthName} ${year} (last label: "${label}")`);
        cy.get('[data-testid="incrementMonth"]').click();
        cy.get('[data-testid="selected-month-label"]').should("not.have.text", label);
        goToMonth(clicksLeft - 1);
      });
  };
  goToMonth(13);

  // Day buttons carry no date attribute, only the day number (the first of a month also shows
  // its month), so match the number at the end of the text, then confirm via the URL.
  cy.contains('[data-testid="day"][data-disabled="false"]', new RegExp(`(^|\\D)${day.day}$`)).click();
  cy.location("search").should("include", `date=${day.toISODate()}`);
});

Cypress.Commands.add("pickTime", (utcIso) => {
  return cy
    .get(`[data-testid="time"][data-time="${utcIso}"]`)
    .should("have.attr", "data-disabled", "false")
    .invoke("text")
    .then((label) => {
      cy.get(`[data-testid="time"][data-time="${utcIso}"]`).click();
      return cy.wrap(label.trim(), { log: false });
    });
});

Cypress.Commands.add("confirmBooking", (guest) => {
  cy.get('input[name="name"]').clear().type(guest.name);
  cy.get('input[name="email"]').clear().type(guest.email);
  cy.get('[data-testid="confirm-book-button"]').click();
  cy.location("pathname", { timeout: 20_000 }).should("match", /^\/booking\/[A-Za-z0-9]+$/);
  cy.get('[data-testid="success-page"]').should("contain.text", "This meeting is scheduled");
  return cy.location("pathname").then((path) => path.split("/").pop()!);
});

export {};
