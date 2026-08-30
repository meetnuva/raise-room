import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icons";
import { IconButton } from "./IconButton";

export type ActionMenuItem = {
  id: string;
  label: string;
  icon: IconName;
  disabled?: boolean;
  disabledReason?: string;
  onSelect(): void;
};

type ActionMenuProps = {
  items: ActionMenuItem[];
  label: string;
  icon?: IconName;
  tone?: "default" | "inverse" | "danger";
};

export function ActionMenu({ items, label, icon = "more", tone }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabledIndexes = items.reduce<number[]>((indexes, item, index) => {
    if (!item.disabled) indexes.push(index);
    return indexes;
  }, []);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;

    itemRefs.current[enabledIndexes[0]]?.focus();
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [enabledIndexes, open]);

  const focusRelativeItem = (currentIndex: number, offset: number) => {
    const enabledPosition = enabledIndexes.indexOf(currentIndex);
    if (enabledPosition < 0 || enabledIndexes.length === 0) return;
    const nextPosition = (enabledPosition + offset + enabledIndexes.length) % enabledIndexes.length;
    itemRefs.current[enabledIndexes[nextPosition]]?.focus();
  };

  return (
    <div className="action-menu" ref={containerRef}>
      <IconButton
        aria-expanded={open}
        aria-haspopup="menu"
        icon={icon}
        label={label}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        tone={tone}
      />
      {open ? (
        <div aria-label={label} className="action-menu-content" role="menu">
          {items.map((item, index) => (
            <button
              aria-disabled={item.disabled || undefined}
              className="action-menu-item"
              disabled={item.disabled}
              key={item.id}
              onClick={() => {
                item.onSelect();
                close();
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  focusRelativeItem(index, 1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  focusRelativeItem(index, -1);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  itemRefs.current[enabledIndexes[0]]?.focus();
                } else if (event.key === "End") {
                  event.preventDefault();
                  itemRefs.current[enabledIndexes[enabledIndexes.length - 1] ?? -1]?.focus();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                } else if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  item.onSelect();
                  close();
                }
              }}
              ref={(element) => { itemRefs.current[index] = element; }}
              role="menuitem"
              title={item.disabledReason}
              type="button"
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
