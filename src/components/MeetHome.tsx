import { useState } from "react";
import {
  formatPracticeTimeRange,
  getPracticeScheduleStatus,
  type ScheduledPracticeMeeting,
} from "../domain/practice-schedule";
import { NuvaBrand } from "./NuvaBrand";

type HomeTab = "meetings" | "history";

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function dateLabel(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function weekdayLabel(date: Date) {
  return new Intl.DateTimeFormat("zh-TW", { weekday: "short" }).format(date);
}

function scheduleStatusLabel(meeting: ScheduledPracticeMeeting, now: Date) {
  const labels = {
    upcoming: "即將開始",
    active: "進行中",
    ended: "已結束",
  } as const;

  return labels[getPracticeScheduleStatus(meeting, now)];
}

export function MeetHome({
  meeting,
  now,
  onOpenSettings,
  onEnterLobby,
}: {
  meeting: ScheduledPracticeMeeting;
  now: Date;
  onOpenSettings: () => void;
  onEnterLobby: () => void;
}) {
  const today = startOfLocalDay(now);
  const [activeTab, setActiveTab] = useState<HomeTab>("meetings");
  const [selectedDate, setSelectedDate] = useState(today);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });
  const selectedDateHasMeeting = isSameLocalDay(selectedDate, new Date(meeting.startsAt));

  return (
    <div className="meet-home">
      <header className="meet-home-header">
        <NuvaBrand />
        <div className="meet-home-header-actions">
          <button aria-label="設定" className="meet-home-settings" title="設定" type="button" onClick={onOpenSettings}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M19.14 12.94a7.43 7.43 0 0 0 .05-.94 7.43 7.43 0 0 0-.05-.94l2.03-1.58-1.92-3.32-2.39.96a7.18 7.18 0 0 0-1.62-.94L14.88 3h-3.84l-.36 3.18a7.18 7.18 0 0 0-1.62.94l-2.39-.96-1.92 3.32 2.03 1.58a7.43 7.43 0 0 0-.05.94c0 .32.02.63.05.94l-2.03 1.58 1.92 3.32 2.39-.96c.5.39 1.04.71 1.62.94l.36 3.18h3.84l.36-3.18c.58-.23 1.12-.55 1.62-.94l2.39.96 1.92-3.32-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" />
            </svg>
          </button>
          <span aria-label="本機使用者" className="meet-home-avatar">你</span>
        </div>
      </header>

      <div className="meet-home-layout">
        <nav aria-label="首頁導覽" className="meet-home-nav">
          <button
            aria-current={activeTab === "meetings" ? "page" : undefined}
            className={activeTab === "meetings" ? "active" : undefined}
            type="button"
            onClick={() => setActiveTab("meetings")}
          >
            會議
          </button>
          <button
            aria-current={activeTab === "history" ? "page" : undefined}
            className={activeTab === "history" ? "active" : undefined}
            type="button"
            onClick={() => setActiveTab("history")}
          >
            練習紀錄
          </button>
        </nav>

        <section className="meet-home-content">
          <h1 className="visually-hidden">Raise Room</h1>
          {activeTab === "history" ? (
            <section aria-labelledby="practice-history-title" className="meet-home-empty-state">
              <h2 id="practice-history-title">練習紀錄</h2>
              <p>尚無練習紀錄</p>
            </section>
          ) : (
            <>
              <section aria-labelledby="schedule-title" className="meet-home-schedule">
                <div className="meet-home-section-heading">
                  <div>
                    <p className="meet-home-kicker">今天的安排</p>
                    <h2 id="schedule-title">排定練習</h2>
                  </div>
                  <p>{dateLabel(selectedDate)}</p>
                </div>

                <div aria-label="選擇日期" className="meet-home-date-strip">
                  {dates.map((date) => {
                    const isSelected = isSameLocalDay(selectedDate, date);
                    const isToday = isSameLocalDay(today, date);

                    return (
                      <button
                        aria-current={isToday ? "date" : undefined}
                        aria-pressed={isSelected}
                        className={isSelected ? "selected" : undefined}
                        key={date.toISOString()}
                        type="button"
                        onClick={() => setSelectedDate(date)}
                      >
                        <span>{weekdayLabel(date)}</span>
                        <strong>{dateLabel(date)}</strong>
                      </button>
                    );
                  })}
                </div>

                {selectedDateHasMeeting ? (
                  <article aria-labelledby="scheduled-meeting-title" className="meet-home-schedule-card">
                    <div className="meet-home-schedule-time">
                      <time>{formatPracticeTimeRange(meeting, "zh-TW")}</time>
                      <span>{scheduleStatusLabel(meeting, now)}</span>
                    </div>
                    <div>
                      <h3 id="scheduled-meeting-title">{meeting.title}</h3>
                      <p>{meeting.company} · {meeting.role}</p>
                    </div>
                    <button className="meet-home-enter" type="button" onClick={onEnterLobby}>
                      提早進入準備室
                    </button>
                  </article>
                ) : (
                  <p className="meet-home-empty-state">這一天沒有安排練習</p>
                )}
              </section>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
