import { useEffect, useRef, useState } from "react";
import { ActionMenu } from "./ui/ActionMenu";
import { IconButton } from "./ui/IconButton";

export type HomeSettingsTarget = "audio" | "video" | "voice" | "manager" | "personality" | "meeting" | "privacy";

type HomePopover = "about" | "help" | "user" | null;

export function HomeChrome({ onOpenSettings }: { onOpenSettings(target?: HomeSettingsTarget): void }) {
  const [openPopover, setOpenPopover] = useState<HomePopover>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openPopover) return undefined;
    const dismiss = (event: MouseEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) setOpenPopover(null);
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, [openPopover]);

  const openAbout = () => setOpenPopover("about");
  const openUser = () => setOpenPopover("user");

  return (
    <div
      className="meet-home-header-actions"
      ref={controlsRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpenPopover(null);
      }}
    >
      <IconButton aria-expanded={openPopover === "help"} icon="help" label="說明" onClick={() => setOpenPopover("help")} />
      <IconButton icon="settings" label="設定" title="設定" onClick={() => onOpenSettings()} />
      <ActionMenu
        items={[
          { id: "devices", label: "檢查裝置", icon: "devices", onSelect: () => onOpenSettings("audio") },
          { id: "privacy", label: "查看本機資料與隱私", icon: "info", onSelect: () => onOpenSettings("privacy") },
          { id: "about", label: "關於 Raise Room", icon: "help", onSelect: openAbout },
        ]}
        label="更多選項"
      />
      <button
        aria-expanded={openPopover === "user"}
        aria-label="本機使用者"
        className="meet-home-avatar"
        type="button"
        onClick={openUser}
      >你</button>
      {openPopover === "help" ? (
        <section aria-label="Raise Room 使用說明" className="meet-home-popover" role="dialog">
          <h2>Raise Room 使用說明</h2>
          <p>依序查看排程、進入準備室，再開始本機模擬會議。</p>
          <p>設定、草稿與媒體處理都留在這台裝置；可使用 Tab、Enter 與 Escape 操作。</p>
        </section>
      ) : null}
      {openPopover === "about" ? (
        <section aria-label="關於 Raise Room" className="meet-home-popover" role="dialog">
          <h2>關於 Raise Room</h2>
          <p>Raise Room 是 nuva 的本機薪資談判練習空間。</p>
        </section>
      ) : null}
      {openPopover === "user" ? (
        <section aria-label="本機使用者" className="meet-home-popover" role="dialog">
          <h2>本機使用者</h2>
          <p>資料只存在這台裝置</p>
          <button type="button" onClick={() => onOpenSettings("privacy")}>隱私設定</button>
        </section>
      ) : null}
    </div>
  );
}
