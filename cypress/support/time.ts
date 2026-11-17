import { DateTime } from "luxon";

/**
 * Time-zone maths for the tests. Expected times are always calculated here,
 * never typed in by hand, so the tests stay correct in any season.
 */

const isWeekday = (d: DateTime) => d.weekday <= 5; // luxon: Monday = 1 ... Sunday = 7

/** The next weekday at least `minDaysAhead` days from today, in `zone` (start of that day). */
export function nextWeekday(zone: string, minDaysAhead = 2, from: DateTime = DateTime.now()): DateTime {
  let day = from.setZone(zone).startOf("day").plus({ days: minDaysAhead });
  while (!isWeekday(day)) day = day.plus({ days: 1 });
  return day;
}

/** A wall-clock time ("10:00") on `day` in the day's zone, as the exact UTC moment Cal.com puts in `data-time`. */
export function wallTimeToUtcIso(day: DateTime, hhmm: string): string {
  const [hour, minute] = hhmm.split(":").map(Number);
  return day.set({ hour, minute, second: 0, millisecond: 0 }).toUTC().toISO()!;
}

/** The same calendar date as `day`, starting at midnight in `zone` (e.g. a New York date, as a day in India). */
export function sameDateIn(day: DateTime, zone: string): DateTime {
  return DateTime.fromObject({ year: day.year, month: day.month, day: day.day }, { zone });
}

/** The calendar day a UTC moment falls on in `zone`, as a DateTime (for opening it in the calendar). */
export function dayIn(utcIso: string, zone: string): DateTime {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(zone).startOf("day");
}

/** The UTC offset, in minutes, that `zone` uses at a UTC moment (e.g. -300 for New York in winter). */
export function offsetIn(utcIso: string, zone: string): number {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(zone).offset;
}

/** How a UTC moment reads on a clock in `zone`, e.g. "20:30". */
export function clockTimeIn(utcIso: string, zone: string, format = "HH:mm"): string {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(zone).toFormat(format);
}

/** The calendar date (yyyy-MM-dd) a UTC moment falls on in `zone`. */
export function dateIn(utcIso: string, zone: string): string {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(zone).toISODate()!;
}

/** What the guest's confirmation page should show for a booking, in the guest's zone. */
export function confirmationText(startUtcIso: string, lengthMinutes: number, zone: string) {
  const start = DateTime.fromISO(startUtcIso, { zone: "utc" }).setZone(zone).setLocale("en-US");
  const end = start.plus({ minutes: lengthMinutes });
  return {
    date: start.toFormat("cccc, LLLL d, yyyy"), // "Wednesday, November 18, 2026"
    times: `${start.toFormat("HH:mm")} - ${end.toFormat("HH:mm")}`, // "20:30 - 21:00"
    zoneName: start.toFormat("ZZZZZ"), // "India Standard Time"
  };
}

/** What the host's bookings list should show, in the host's zone and 12-hour clock: "Thu, 19 Nov" / "10:00am - 10:30am". */
export function hostListText(startUtcIso: string, lengthMinutes: number, zone: string) {
  const start = DateTime.fromISO(startUtcIso, { zone: "utc" }).setZone(zone).setLocale("en-US");
  const end = start.plus({ minutes: lengthMinutes });
  const clock = (d: DateTime) => d.toFormat("h:mma").toLowerCase();
  return { date: start.toFormat("ccc, d LLL"), times: `${clock(start)} - ${clock(end)}` };
}

/**
 * The next time `zone` changes its UTC offset (daylight saving starts or ends),
 * with the weekday just before and just after it. The weekday before is at least
 * `minDaysAhead` days away, so both days can still be booked.
 */
export function nextOffsetChange(zone: string, minDaysAhead = 2, from: DateTime = DateTime.now()) {
  const earliest = from.setZone(zone).startOf("day").plus({ days: minDaysAhead });
  for (let day = earliest.plus({ days: 1 }); day < earliest.plus({ days: 400 }); day = day.plus({ days: 1 })) {
    const offsetToday = day.set({ hour: 12 }).offset;
    const offsetYesterday = day.minus({ days: 1 }).set({ hour: 12 }).offset;
    if (offsetToday === offsetYesterday) continue;

    let before = day.minus({ days: 1 });
    while (!isWeekday(before)) before = before.minus({ days: 1 });
    let after = day;
    while (!isWeekday(after)) after = after.plus({ days: 1 });
    if (before < earliest) continue; // too soon to book; look for the following change

    return {
      changeDay: day,
      weekdayBefore: before,
      weekdayAfter: after,
      offsetBeforeMinutes: offsetYesterday,
      offsetAfterMinutes: offsetToday,
    };
  }
  throw new Error(`No UTC offset change found for ${zone} in the next 400 days`);
}
