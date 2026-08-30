import { useRef } from "react";
import { ActionMenu } from "./ui/ActionMenu";

type ParticipantKind = "manager" | "self";

type ParticipantMenuProps = {
  kind: ParticipantKind;
  pinned: boolean;
  expanded: boolean;
  onTogglePin: () => void;
  onToggleExpand?: () => void;
  onViewRole?: (opener: HTMLButtonElement | null) => void;
  onOpenInfo?: (opener: HTMLButtonElement | null) => void;
  onOpenDevices?: (opener: HTMLButtonElement | null) => void;
};

export function ParticipantMenu({
  kind,
  pinned,
  expanded,
  onTogglePin,
  onToggleExpand,
  onViewRole,
  onOpenInfo,
  onOpenDevices,
}: ParticipantMenuProps) {
  const isManager = kind === "manager";
  const triggerRef = useRef<HTMLButtonElement>(null);
  const items = isManager
    ? [
        { id: "pin", label: pinned ? "取消釘選主管" : "釘選主管", icon: "pin" as const, onSelect: onTogglePin },
        { id: "role", label: "查看主管角色", icon: "account" as const, onSelect: () => onViewRole?.(triggerRef.current) },
        { id: "info", label: "開啟會議資訊", icon: "info" as const, onSelect: () => onOpenInfo?.(triggerRef.current) },
      ]
    : [
        { id: "expand", label: expanded ? "還原主管畫面" : "放大自己", icon: "expand" as const, onSelect: onToggleExpand ?? (() => {}) },
        { id: "pin", label: pinned ? "取消釘選自己" : "釘選自己", icon: "pin" as const, onSelect: onTogglePin },
        { id: "devices", label: "開啟裝置設定", icon: "devices" as const, onSelect: () => onOpenDevices?.(triggerRef.current) },
      ];

  return <ActionMenu items={items} label={isManager ? "主管更多操作" : "你的更多操作"} tone="inverse" triggerRef={triggerRef} />;
}
