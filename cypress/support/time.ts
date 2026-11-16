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

/** How a UTC moment reads on a clock in `zone`, e.g. "20:30". */
export function clockTimeIn(utcIso: string, zone: string, format = "HH:mm"): string {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(zone).toFormat(format);
}

/** The calendar date (yyyy-MM-dd) a UTC moment falls on in `zone`. */
export function dateIn(utcIso: string, zone: string): string {
  return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(zone).toISODate()!;
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
