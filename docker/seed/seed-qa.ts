import { hash } from "bcryptjs";

import prisma from "@calcom/prisma";

type Host = { username: string; name: string; email: string; timeZone: string };

const PASSWORD = "QaHost-Passw0rd!"; // test-only, shared by both hosts

// Two hosts, so clock changes are tested on both sides of a booking: New York changes
// its clocks (a host-side change); India never does (so the change is on the guest's side).
// Keep in step with cypress/support/test-data.ts.
const HOSTS: Host[] = [
  { username: "qa-host", name: "QA Host", email: "qa-host@cal-qa.test", timeZone: "America/New_York" },
  { username: "qa-host-in", name: "QA Host India", email: "qa-host-in@cal-qa.test", timeZone: "Asia/Kolkata" },
];
const EVENT = { title: "30 min meeting", slug: "30min", length: 30 };

// Availability times are stored as time-of-day in the schedule's time zone.
const timeOfDay = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

/** Creates (or resets) one host: Mon–Fri 09:00–17:00 in their own time zone, and one 30-minute event. */
async function seedHost(host: Host, passwordHash: string) {
  const user = await prisma.user.upsert({
    where: { email: host.email },
    update: {},
    create: {
      username: host.username,
      name: host.name,
      email: host.email,
      emailVerified: new Date(),
      timeZone: host.timeZone,
      completedOnboarding: true,
      password: { create: { hash: passwordHash } },
    },
  });

  // Reset schedule and event types so every run starts from the same state.
  await prisma.eventType.deleteMany({ where: { userId: user.id } });
  await prisma.availability.deleteMany({ where: { userId: user.id } });
  await prisma.schedule.deleteMany({ where: { userId: user.id } });

  const schedule = await prisma.schedule.create({
    data: {
      name: "Working hours",
      timeZone: host.timeZone,
      user: { connect: { id: user.id } },
      availability: {
        create: [{ userId: user.id, days: [1, 2, 3, 4, 5], startTime: timeOfDay("09:00"), endTime: timeOfDay("17:00") }],
      },
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { defaultScheduleId: schedule.id, timeZone: host.timeZone },
  });

  const eventType = await prisma.eventType.create({
    data: {
      title: EVENT.title,
      slug: EVENT.slug,
      length: EVENT.length,
      owner: { connect: { id: user.id } },
      users: { connect: { id: user.id } },
      schedule: { connect: { id: schedule.id } },
    },
  });

  console.log(
    JSON.stringify({ userId: user.id, username: host.username, scheduleId: schedule.id, eventTypeId: eventType.id, url: `/${host.username}/${EVENT.slug}` })
  );
}

async function main() {
  try {
    const passwordHash = await hash(PASSWORD, 12);
    for (const host of HOSTS) await seedHost(host, passwordHash);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
