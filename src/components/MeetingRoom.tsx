import { useState } from "react";
import {
  advanceMeeting,
  appendUserTurn,
  createMeeting,
  respondToUser,
  type ManagerResponder,
} from "../domain/meeting";
import type { TranscriptTurn } from "../domain/meeting";
import type { Scenario, ScheduledEvent } from "../domain/scenario";
import { useLocalCamera } from "../hooks/use-local-camera";
import type { PresenterRuntimeConfig } from "../lib/perxona-config";
import { LocalCameraTile } from "./LocalCameraTile";
import { PerxonaManagerStage } from "./PerxonaManagerStage";

const meetingLengthSeconds = 10 * 60;

function formatCountdown(elapsedSeconds: number) {
  const remainingSeconds = Math.max(0, meetingLengthSeconds - elapsedSeconds);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function eventTitle(event: ScheduledEvent) {
  if (event.id === "budget-freeze") {
    return "本季預算已凍結";
  }

  return event.label;
}

export function MeetingRoom({
  scenario,
  responder,
  onFinish,
  presenterConfig = { enabled: false, reason: "missing-key" },
}: {
  scenario: Scenario;
  responder: ManagerResponder;
  onFinish?: (transcript: TranscriptTurn[]) => void;
  presenterConfig?: PresenterRuntimeConfig;
}) {
  const [meeting, setMeeting] = useState(() => createMeeting(scenario));
  const [draft, setDraft] = useState("");
  const latestTurn = meeting.transcript[meeting.transcript.length - 1];
  const camera = useLocalCamera();

  const advanceTo = (elapsedSeconds: number) => {
    setMeeting((current) => advanceMeeting(current, elapsedSeconds));
  };

  const sendFallbackMessage = async () => {
    const text = draft.trim();
    if (!text) return;

    const userTurn = appendUserTurn(meeting, text);
    setMeeting(userTurn);
    setDraft("");
    const repliedMeeting = await respondToUser(userTurn, scenario, responder);
    const managerTurn = repliedMeeting.transcript[repliedMeeting.transcript.length - 1];
    setMeeting((current) => ({
      ...current,
      transcript: [...current.transcript, managerTurn],
    }));
  };

  return (
    <section aria-labelledby="meeting-room-title" className="meeting-room">
      <header className="meeting-header">
        <div>
          <p className="eyebrow">本機模擬會議</p>
          <h2 id="meeting-room-title">薪資檢討 Raise Room</h2>
        </div>
        <p className="meeting-countdown" aria-label={`剩餘時間 ${formatCountdown(meeting.elapsedSeconds)}`}>
          剩餘 {formatCountdown(meeting.elapsedSeconds)}
        </p>
      </header>

      <div className="meeting-stages" aria-label="會議雙人畫面">
        <PerxonaManagerStage
          managerName={scenario.manager.name}
          config={presenterConfig}
          latestManagerText={latestTurn?.speaker === "manager" ? latestTurn.text : null}
        />
        <aside className="meeting-sidebar">
          <LocalCameraTile
            camera={camera}
            detail={`${scenario.company} · ${scenario.tenureMonths} 個月年資`}
            showControl={false}
          />
          <section className="event-rail" aria-labelledby="event-rail-title">
            <p className="eyebrow">事件軌</p>
            <h3 id="event-rail-title">會議壓力事件</h3>
            <ol>
              {scenario.events.map((event) => {
                const emitted = meeting.emittedEventIds.includes(event.id);

                return (
                  <li className={emitted ? "event-card emitted" : "event-card"} key={event.id}>
                    <span>第 {event.minute} 分鐘 · {emitted ? "已發生" : "待命"}</span>
                    <strong>{eventTitle(event)}</strong>
                    <p>{event.instruction}</p>
                  </li>
                );
              })}
            </ol>
          </section>
        </aside>
      </div>

      <div className="meeting-controls" aria-label="會議控制">
        <button disabled type="button">麥克風：尚未啟用</button>
        <button
          type="button"
          onClick={() => camera.status === "active" ? camera.stop() : void camera.start()}
          disabled={camera.status === "requesting"}
        >
          {camera.status === "active" ? "關閉我的鏡頭" : "開啟我的鏡頭"}
        </button>
        <button type="button" onClick={() => advanceTo(180)}>跳到第 3 分鐘</button>
        <button
          className="finish-meeting"
          type="button"
          onClick={() => onFinish?.(meeting.transcript)}
        >
          結束並看報告
        </button>
      </div>

      <div className="meeting-details">
        <section className="transcript-panel" aria-labelledby="transcript-title">
          <div className="panel-heading">
            <p className="eyebrow">逐字稿</p>
            <h3 id="transcript-title">對話紀錄</h3>
          </div>
          {meeting.transcript.length === 0 ? (
            <p className="empty-transcript">尚未有對話。你可以先說明這次的調整請求。</p>
          ) : (
            <ol className="transcript-list">
              {meeting.transcript.map((turn, index) => (
                <li
                  key={`${turn.speaker}-${turn.elapsedSeconds}-${index}`}
                  className={`transcript-turn ${turn.speaker}`}
                >
                  <strong>{turn.speaker === "manager" ? scenario.manager.name : "你"}</strong>
                  <span>{turn.text}</span>
                </li>
              ))}
            </ol>
          )}
          <form
            className="development-fallback"
            onSubmit={(event) => {
              event.preventDefault();
              void sendFallbackMessage();
            }}
          >
            <label htmlFor="development-message">開發用文字輸入</label>
            <div>
              <input
                id="development-message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="暫代語音輸入，僅供開發測試"
              />
              <button type="submit">送出</button>
            </div>
          </form>
        </section>
      </div>
    </section>
  );
}
