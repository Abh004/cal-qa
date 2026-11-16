import { z } from "zod";

/**
 * Cal.com public API v2: GET /v2/slots (no API key needed for public events).
 * Docs: https://cal.com/docs/api-reference/v2/slots
 */

export const apiConfig = () => ({
  baseUrl: Cypress.expose("apiBaseUrl") as string,
  version: Cypress.expose("apiVersion") as string,
  username: Cypress.expose("apiUsername") as string,
  eventSlug: Cypress.expose("apiEventSlug") as string,
  eventLengthMinutes: Cypress.expose("apiEventLengthMinutes") as number,
});

/** One bookable time. `start` is ISO 8601 with an offset: "...Z" by default, "+05:30" when timeZone=Asia/Kolkata. */
const Slot = z.object({ start: z.iso.datetime({ offset: true }) });

/** 200 response: times grouped by calendar date (yyyy-MM-dd). An empty object means no times. */
export const SlotsSuccess = z.object({
  status: z.literal("success"),
  data: z.record(z.iso.date(), z.array(Slot)),
});

/** 4xx response shape used by API v2. */
export const ApiError = z.object({
  status: z.literal("error"),
  timestamp: z.iso.datetime({ offset: true }),
  path: z.string(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type SlotsQuery = Partial<{
  username: string;
  eventTypeSlug: string;
  start: string;
  end: string;
  timeZone: string;
  duration: number;
}>;

/** Calls GET /v2/slots without failing on 4xx, so tests can assert error responses. */
export function getSlots(query: SlotsQuery) {
  const cfg = apiConfig();
  return cy.request({
    method: "GET",
    url: `${cfg.baseUrl}/slots`,
    qs: { username: cfg.username, eventTypeSlug: cfg.eventSlug, ...query },
    headers: { "cal-api-version": cfg.version },
    failOnStatusCode: false,
  });
}

/** Parses a body with a zod schema and fails the test with a readable message if it doesn't match. */
export function expectShape<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Error(`Response doesn't match the expected shape:\n${z.prettifyError(result.error)}\n\nBody: ${JSON.stringify(body).slice(0, 500)}`);
  }
  return result.data;
}
