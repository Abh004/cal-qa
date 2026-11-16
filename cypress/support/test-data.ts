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

/** Guest time zone used by the cross-time-zone tests. No daylight saving, UTC+05:30. */
export const GUEST_TIME_ZONE = "Asia/Kolkata";

/** A unique guest per test run, so bookings never collide across runs or retries. */
export const newGuest = (label: string) => {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return { name: `QA Guest ${label}`, email: `qa.guest+${label}-${id}@cal-qa.test` };
};
