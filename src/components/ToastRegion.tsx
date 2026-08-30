import { useEffect, useRef } from "react";
import { IconButton } from "./ui/IconButton";

export type MeetingToast = {
  id: string;
  tone: "notice" | "error";
  message: string;
  durationMs?: number;
};

type ToastRegionProps = {
  toasts: Array<MeetingToast & { onDismiss(id: string): void }>;
};

function Toast({ id, tone, message, durationMs, onDismiss }: MeetingToast & { onDismiss(id: string): void }) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (tone === "error" || !durationMs) return undefined;
    const timer = window.setTimeout(() => onDismissRef.current(id), durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, id, message, tone]);

  return (
    <div className={`meeting-toast meeting-toast--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <p>{message}</p>
      <IconButton icon="close" label={`關閉通知：${message}`} onClick={() => onDismiss(id)} tone="inverse" />
    </div>
  );
}

export function ToastRegion({ toasts }: ToastRegionProps) {
  return <section aria-label="會議通知" className="toast-region">{toasts.map((toast) => <Toast key={toast.id} {...toast} />)}</section>;
}
