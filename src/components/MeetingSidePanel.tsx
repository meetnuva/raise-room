import { type ReactNode, useState } from "react";
import type { TranscriptTurn } from "../domain/meeting";
import { getEventOffsetSeconds, type ScheduledEvent } from "../domain/scenario";

type Tab = "transcript" | "events" | "observations";

type MeetingSidePanelProps = {
  transcript: TranscriptTurn[];
  events: ScheduledEvent[];
  emittedEventIds: string[];
  durationSeconds: number;
  managerName: string;
  observationContent: ReactNode;
  transcriptFallback?: ReactNode;
  onClose: () => void;
};

function formatOffset(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function MeetingSidePanel({
  transcript,
  events,
  emittedEventIds,
  durationSeconds,
  managerName,
  observationContent,
  transcriptFallback,
  onClose,
}: MeetingSidePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("transcript");
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "transcript", label: "逐字稿" },
    { id: "events", label: "壓力事件" },
    { id: "observations", label: "觀察" },
  ];

  return (
    <aside className="meeting-side-panel" aria-label="會議資訊">
      <div className="meeting-side-panel-header">
        <div role="tablist" aria-label="會議資訊分頁">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button type="button" aria-label="關閉資訊面板" onClick={onClose}>
          關閉
        </button>
      </div>

      {activeTab === "transcript" && (
        <section className="transcript-panel" aria-labelledby="transcript-title">
          <h3 id="transcript-title">對話紀錄</h3>
          {transcript.length === 0 ? (
            <p className="empty-transcript">尚未有對話。你可以先說明這次的調整請求。</p>
          ) : (
            <ol className="transcript-list">
              {transcript.map((turn, index) => (
                <li
                  key={`${turn.speaker}-${turn.elapsedSeconds}-${index}`}
                  className={`transcript-turn ${turn.speaker}`}
                >
                  <strong>{turn.speaker === "manager" ? managerName : "你"}</strong>
                  <span>{turn.text}</span>
                </li>
              ))}
            </ol>
          )}
          {transcriptFallback}
        </section>
      )}

      {activeTab === "events" && (
        <section className="event-rail" aria-labelledby="event-rail-title">
          <h3 id="event-rail-title">會議壓力事件</h3>
          <ol>
            {events.map((event) => {
              const emitted = emittedEventIds.includes(event.id);

              return (
                <li className={emitted ? "event-card emitted" : "event-card"} key={event.id}>
                  <span>
                    {formatOffset(getEventOffsetSeconds(event, durationSeconds))} · {emitted ? "已發生" : "待命"}
                  </span>
                  <strong>{event.id === "budget-freeze" ? "本季預算已凍結" : event.label}</strong>
                  <p>{event.instruction}</p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {activeTab === "observations" && (
        <section className="meeting-observations" aria-labelledby="observations-title">
          <h3 id="observations-title">本機觀察</h3>
          {observationContent}
        </section>
      )}
    </aside>
  );
}
