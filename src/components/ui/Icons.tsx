import type { ReactNode } from "react";

export type IconName =
  | "settings"
  | "help"
  | "more"
  | "account"
  | "meeting"
  | "history"
  | "microphone"
  | "microphoneOff"
  | "camera"
  | "cameraOff"
  | "captions"
  | "events"
  | "info"
  | "close"
  | "leave"
  | "back"
  | "pin"
  | "expand"
  | "devices"
  | "check"
  | "warning"
  | "loading";

type IconPaths = Record<IconName, ReactNode>;

const iconPaths: IconPaths = {
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56V20.3h-3v-.08A1.7 1.7 0 0 0 10.66 18.66a1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.56-1.04H5.3v-3h.14A1.7 1.7 0 0 0 7 9.92a1.7 1.7 0 0 0-.34-1.88L6.6 7.98l2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.7 4.7v-.08h3v.08a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.4 9.92a1.7 1.7 0 0 0 1.56 1.04h.14v3h-.14A1.7 1.7 0 0 0 19.4 15Z" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.4 2.4 0 1 1 3.54 2.12c-.74.4-1.14.86-1.14 1.88" /><path d="M12 16.5h.01" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  account: <><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
  meeting: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M7.5 3.5v3M16.5 3.5v3M7 10h10M8.5 14h2M13.5 14h2" /></>,
  history: <><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><path d="M3.5 5.5v4h4M12 7v5l3.5 2" /></>,
  microphone: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v4M8.5 21h7" /></>,
  microphoneOff: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6.5 11.5a5.5 5.5 0 0 0 9.2 4.12M12 17v4M8.5 21h7M4 4l16 16" /></>,
  camera: <><rect x="3" y="6.5" width="13" height="11" rx="2" /><path d="m16 10 4-2.5v9L16 14" /></>,
  cameraOff: <><rect x="3" y="6.5" width="13" height="11" rx="2" /><path d="m16 10 4-2.5v9L16 14M4 4l16 16" /></>,
  captions: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 10h4M13 10h4M7 14h3M12 14h5" /></>,
  events: <><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="7" /><path d="m12 8 1.2 2.8L16 12l-2.8 1.2L12 16l-1.2-2.8L8 12l2.8-1.2Z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7.5h.01" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  leave: <><path d="M4 8.5c4.8-2 11.2-2 16 0l-1.4 7.25c-4.05 1.67-9.15 1.67-13.2 0L4 8.5Z" /><path d="M9 12h6" /></>,
  back: <><path d="m11 5-7 7 7 7M4 12h16" /></>,
  pin: <><path d="m8 4 8 0 1 6 2 2v2H5v-2l2-2 1-6ZM12 14v6" /></>,
  expand: <><path d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5" /></>,
  devices: <><rect x="3" y="5" width="12" height="9" rx="1.5" /><path d="M7 19h5M9.5 14v5M18 7v10M16 9h4M16 15h4" /></>,
  check: <path d="m5 12 4.2 4.2L19 6.5" />,
  warning: <><path d="m12 3 9 17H3L12 3Z" /><path d="M12 9v5M12 17h.01" /></>,
  loading: <path d="M20 12a8 8 0 1 1-2.34-5.66" />,
};

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className={name === "loading" ? "ui-icon ui-icon--loading" : "ui-icon"}
      data-testid="ui-icon"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      {iconPaths[name]}
    </svg>
  );
}
