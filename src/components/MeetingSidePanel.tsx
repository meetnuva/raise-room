import { type ReactNode, useEffect } from "react";
import type { TranscriptTurn } from "../domain/meeting";
import { getEventOffsetSeconds, type ScheduledEvent } from "../domain/scenario";
import { Icon, type IconName } from "./ui/Icons";
import { IconButton } from "./ui/IconButton";

export type MeetingPanelTab = "transcript" | "events" | "observations" | "devices";

type MeetingSidePanelProps = {
  activeTab: MeetingPanelTab;
  motion?: "entering" | "entered" | "leaving";
  onActiveTabChange(tab: MeetingPanelTab): void;
  transcript: TranscriptTurn[];
  events: ScheduledEvent[];
  emittedEventIds: string[];
  durationSeconds: number;
  managerName: string;
  observationContent: ReactNode;
  voiceContent: ReactNode;
  deviceContent: ReactNode;
  transcriptFallback?: ReactNode;
  onClose: () => void;
};

function formatOffset(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function MeetingSidePanel({
  activeTab,
  motion = "entered",
  onActiveTabChange,
  transcript,
  events,
  emittedEventIds,
  durationSeconds,
  managerName,
  observationContent,
  voiceContent,
  deviceContent,
  transcriptFallback,
  onClose,
}: MeetingSidePanelProps) {
  const tabs: Array<{ id: MeetingPanelTab; label: string; accessibleLabel: string; icon: IconName }> = [
    { id: "transcript", label: "逐字稿", accessibleLabel: "逐字稿", icon: "captions" },
    { id: "events", label: "事件", accessibleLabel: "壓力事件", icon: "events" },
    { id: "observations", label: "觀察", accessibleLabel: "觀察", icon: "info" },
    { id: "devices", label: "裝置", accessibleLabel: "裝置", icon: "devices" },
  ];
  const selectTabFromKeyboard = (tab: MeetingPanelTab, key: string) => {
    const direction = key === "ArrowRight" || key === "ArrowDown" ? 1 : key === "ArrowLeft" || key === "ArrowUp" ? -1 : 0;
    if (!direction) return;
    const nextTab = tabs[(tabs.findIndex((item) => item.id === tab) + direction + tabs.length) % tabs.length];
    onActiveTabChange(nextTab.id);
    document.getElementById(`meeting-information-${nextTab.id}-tab`)?.focus();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside className="meeting-side-panel" aria-label="會議資訊" data-motion={motion}>
      <div className="meeting-side-panel-header">
        <div role="tablist" aria-label="會議資訊分頁">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`meeting-information-${tab.id}-tab`}
              type="button"
              role="tab"
              aria-label={tab.accessibleLabel}
              aria-controls={`meeting-information-${tab.id}-panel`}
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => onActiveTabChange(tab.id)}
              onKeyDown={(event) => {
                selectTabFromKeyboard(tab.id, event.key);
                if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) event.preventDefault();
              }}
            >
              <Icon name={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </div>
        <IconButton className="meeting-side-panel-close" icon="close" label="關閉資訊面板" onClick={onClose} />
      </div>

      {activeTab === "transcript" && (
        <section className="transcript-panel" aria-labelledby="meeting-information-transcript-tab" id="meeting-information-transcript-panel" role="tabpanel">
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
          {voiceContent}
        </section>
      )}

      {activeTab === "events" && (
        <section className="event-rail" aria-labelledby="meeting-information-events-tab" id="meeting-information-events-panel" role="tabpanel">
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
        <section className="meeting-observations" aria-labelledby="meeting-information-observations-tab" id="meeting-information-observations-panel" role="tabpanel">
          <h3 id="observations-title">本機觀察</h3>
          {observationContent}
        </section>
      )}

      {activeTab === "devices" && (
        <section className="meeting-devices" aria-labelledby="meeting-information-devices-tab" id="meeting-information-devices-panel" role="tabpanel">
          <h3>裝置狀態</h3>
          {deviceContent}
        </section>
      )}
    </aside>
  );
}
