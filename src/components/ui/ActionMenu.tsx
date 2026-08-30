import { Fragment, type Ref, useEffect, useId, useRef, useState } from "react";
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
  triggerRef?: Ref<HTMLButtonElement>;
  openRequest?: number;
};

export function ActionMenu({ items, label, icon = "more", tone, triggerRef: externalTriggerRef, openRequest = 0 }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const handledOpenRequest = useRef(0);

  const close = (returnFocus = true) => {
    setOpen(false);
    setActiveIndex(null);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (activeIndex === null) {
      menuRef.current?.focus();
      return;
    }
    itemRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  const openMenu = () => {
    const firstEnabledIndex = items.findIndex((item) => !item.disabled);
    setActiveIndex(firstEnabledIndex === -1 ? null : firstEnabledIndex);
    setOpen(true);
  };

  useEffect(() => {
    if (openRequest === 0 || openRequest === handledOpenRequest.current) return;
    handledOpenRequest.current = openRequest;
    openMenu();
  }, [openRequest]);

  const moveActiveItem = (offset: number) => {
    if (activeIndex === null) return;
    const enabledIndexes = items.reduce<number[]>((indexes, item, index) => {
      if (!item.disabled) indexes.push(index);
      return indexes;
    }, []);
    const currentPosition = enabledIndexes.indexOf(activeIndex);
    if (currentPosition < 0 || enabledIndexes.length === 0) return;
    const nextPosition = (currentPosition + offset + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[nextPosition]);
  };

  const selectActiveItem = () => {
    if (activeIndex === null) return;
    const item = items[activeIndex];
    if (!item || item.disabled) return;
    item.onSelect();
    close();
  };
  const setTriggerRef = (element: HTMLButtonElement | null) => {
    triggerRef.current = element;
    if (typeof externalTriggerRef === "function") externalTriggerRef(element);
    else if (externalTriggerRef) externalTriggerRef.current = element;
  };

  return (
    <div className="action-menu" ref={containerRef}>
      <IconButton
        aria-expanded={open}
        aria-haspopup="menu"
        icon={icon}
        label={label}
        onClick={() => (open ? close(false) : openMenu())}
        ref={setTriggerRef}
        tone={tone}
      />
      {open ? (
        <div
          aria-label={label}
          className="action-menu-content"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              moveActiveItem(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              moveActiveItem(-1);
            } else if (event.key === "Home") {
              event.preventDefault();
              const firstEnabledIndex = items.findIndex((item) => !item.disabled);
              setActiveIndex(firstEnabledIndex === -1 ? null : firstEnabledIndex);
            } else if (event.key === "End") {
              event.preventDefault();
              const lastEnabledIndex = items.reduce((lastIndex, item, index) => item.disabled ? lastIndex : index, -1);
              setActiveIndex(lastEnabledIndex === -1 ? null : lastEnabledIndex);
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              selectActiveItem();
            }
          }}
          ref={menuRef}
          role="menu"
          tabIndex={activeIndex === null ? 0 : -1}
        >
          {items.map((item, index) => {
            const reasonId = item.disabled && item.disabledReason ? `${menuId}-${item.id}-reason` : undefined;
            return (
              <Fragment key={item.id}>
                <button
                  aria-describedby={reasonId}
                  aria-disabled={item.disabled || undefined}
                  className="action-menu-item"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onSelect();
                    close();
                  }}
                  ref={(element) => { itemRefs.current[index] = element; }}
                  role="menuitem"
                  tabIndex={index === activeIndex ? 0 : -1}
                  title={item.disabledReason}
                  type="button"
                >
                  <Icon name={item.icon} size={20} />
                  <span>{item.label}</span>
                </button>
                {reasonId ? <span className="visually-hidden" id={reasonId}>{item.disabledReason}</span> : null}
              </Fragment>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
