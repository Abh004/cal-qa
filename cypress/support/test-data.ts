/**
 * The fixed starting data created by docker/seed/seed-qa.ts.
 * Keep the two files in step: if one changes, change the other.
 */
export const HOST = {
  username: "qa-host",
  name: "QA Host",
  email: "qa-host@cal-qa.test",
  password: "QaHost-Passw0rd!", // test-only credential for the local instance
  timeZone: "America/New_York",
  workingHours: { start: "09:00", end: "17:00" }, // Monday to Friday
} as const;

export const EVENT = {
  title: "30 min meeting",
  slug: "30min",
  lengthMinutes: 30,
  path: `/${HOST.username}/30min`,
} as const;

/**
 * A second host in India, which never changes its clocks. With a New York guest, the
 * daylight-saving change happens on the guest's side instead of the host's (TC-06).
 */
export const HOST_IN = {
  username: "qa-host-in",
  name: "QA Host India",
  email: "qa-host-in@cal-qa.test",
  password: HOST.password, // the same test-only credential
  timeZone: "Asia/Kolkata",
  workingHours: { start: "09:00", end: "17:00" }, // Monday to Friday
} as const;

export const EVENT_IN = { ...EVENT, path: `/${HOST_IN.username}/30min` } as const;

/** Guest time zones. Kolkata: UTC+05:30, no daylight saving. New York: changes its clocks twice a year. */
export const KOLKATA = "Asia/Kolkata";
export const NEW_YORK = "America/New_York";

export type Host = typeof HOST | typeof HOST_IN;
export type Event = typeof EVENT | typeof EVENT_IN;

/** A unique guest per test run, so bookings never collide across runs or retries. */
export const newGuest = (label: string) => {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return { name: `QA Guest ${label}`, email: `qa.guest+${label}-${id}@cal-qa.test` };
};
