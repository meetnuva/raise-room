import type { PracticeDurationMinutes } from "./practice-settings";

export type PracticeScheduleStatus = "upcoming" | "active" | "ended";

export interface ScheduledPracticeMeeting {
  id: string;
  title: string;
  managerName: string;
  company: string;
  role: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: PracticeDurationMinutes;
}

export interface CreateScheduledPracticeMeetingInput {
  now: Date;
  durationMinutes: PracticeDurationMinutes;
  managerName: string;
  company: string;
  role: string;
}

export function getStrictNextHour(now: Date): Date {
  if (Number.isNaN(now.getTime())) throw new Error("無法取得目前時間。");
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

export function createScheduledPracticeMeeting(
  input: CreateScheduledPracticeMeetingInput,
): ScheduledPracticeMeeting {
  const start = getStrictNextHour(input.now);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  return {
    id: `practice-${start.toISOString()}-${input.durationMinutes}`,
    title: `與${input.managerName}的年度調薪 1:1`,
    managerName: input.managerName,
    company: input.company,
    role: input.role,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    durationMinutes: input.durationMinutes,
  };
}

export function getPracticeScheduleStatus(
  meeting: ScheduledPracticeMeeting,
  now: Date,
): PracticeScheduleStatus {
  const nowTime = now.getTime();
  if (nowTime < new Date(meeting.startsAt).getTime()) return "upcoming";
  if (nowTime < new Date(meeting.endsAt).getTime()) return "active";
  return "ended";
}

export function formatPracticeTimeRange(
  meeting: ScheduledPracticeMeeting,
  locale?: string,
): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${formatter.format(new Date(meeting.startsAt))}–${formatter.format(new Date(meeting.endsAt))}`;
}
