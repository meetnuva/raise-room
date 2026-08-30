import {
  createScheduledPracticeMeeting,
  formatPracticeTimeRange,
  getPracticeScheduleStatus,
  getStrictNextHour,
} from "./practice-schedule";

test.each([[5, "18:00–18:05"], [10, "18:00–18:10"], [20, "18:00–18:20"]] as const)(
  "schedules the strict next hour for %i minutes",
  (durationMinutes, range) => {
    const meeting = createScheduledPracticeMeeting({
      now: new Date(2026, 7, 30, 17, 5),
      durationMinutes,
      managerName: "王主管",
      company: "nuva",
      role: "產品營運專員",
    });

    expect(formatPracticeTimeRange(meeting, "zh-TW")).toBe(range);
  },
);

test("moves an exact hour to the following hour", () => {
  expect(getStrictNextHour(new Date(2026, 7, 30, 18, 0, 0))).toEqual(new Date(2026, 7, 30, 19, 0, 0));
});

test("rolls 23:30 into the next day", () => {
  expect(getStrictNextHour(new Date(2026, 7, 30, 23, 30))).toEqual(new Date(2026, 7, 31, 0, 0, 0));
});

test("rejects an invalid current time", () => {
  expect(() => getStrictNextHour(new Date("not a date"))).toThrow("無法取得目前時間。");
});

test("creates a meeting with deterministic local-time ISO boundaries", () => {
  const startsAt = new Date(2026, 7, 30, 18, 0, 0).toISOString();
  const endsAt = new Date(2026, 7, 30, 18, 10, 0).toISOString();

  expect(createScheduledPracticeMeeting({
    now: new Date(2026, 7, 30, 17, 5),
    durationMinutes: 10,
    managerName: "王主管",
    company: "nuva",
    role: "產品營運專員",
  })).toMatchObject({
    id: `practice-${startsAt}-10`,
    title: "與王主管的年度調薪 1:1",
    managerName: "王主管",
    company: "nuva",
    role: "產品營運專員",
    startsAt,
    endsAt,
    durationMinutes: 10,
  });
});

test("uses a half-open interval for the meeting status", () => {
  const meeting = createScheduledPracticeMeeting({
    now: new Date(2026, 7, 30, 17, 5),
    durationMinutes: 10,
    managerName: "王主管",
    company: "nuva",
    role: "產品營運專員",
  });

  expect(getPracticeScheduleStatus(meeting, new Date(2026, 7, 30, 17, 59, 59))).toBe("upcoming");
  expect(getPracticeScheduleStatus(meeting, new Date(2026, 7, 30, 18, 0, 0))).toBe("active");
  expect(getPracticeScheduleStatus(meeting, new Date(2026, 7, 30, 18, 9, 59))).toBe("active");
  expect(getPracticeScheduleStatus(meeting, new Date(2026, 7, 30, 18, 10, 0))).toBe("ended");
});
