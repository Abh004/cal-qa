import { hash } from "bcryptjs";

import prisma from "@calcom/prisma";

const HOST = {
  username: "qa-host",
  name: "QA Host",
  email: "qa-host@cal-qa.test",
  password: "QaHost-Passw0rd!", // test-only
  timeZone: "America/New_York",
};
const EVENT = { title: "30 min meeting", slug: "30min", length: 30 };

// Availability times are stored as time-of-day in the schedule's time zone.
const timeOfDay = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

async function main() {
  try {
    const passwordHash = await hash(HOST.password, 12);

    const user = await prisma.user.upsert({
      where: { email: HOST.email },
      update: {},
      create: {
        username: HOST.username,
        name: HOST.name,
        email: HOST.email,
        emailVerified: new Date(),
        timeZone: HOST.timeZone,
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
        timeZone: HOST.timeZone,
        user: { connect: { id: user.id } },
        availability: {
          create: [{ userId: user.id, days: [1, 2, 3, 4, 5], startTime: timeOfDay("09:00"), endTime: timeOfDay("17:00") }],
        },
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      // DELIBERATE REGRESSION (demo/red-run branch only, never merged): the host's profile
      // time zone is saved as London while their working hours stay on New York time.
      // Guests can still book, but the host's dashboard shows every meeting at the wrong hour.
      data: { defaultScheduleId: schedule.id, timeZone: "Europe/London" },
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
      JSON.stringify({ userId: user.id, username: HOST.username, scheduleId: schedule.id, eventTypeId: eventType.id, url: `/${HOST.username}/${EVENT.slug}` })
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
