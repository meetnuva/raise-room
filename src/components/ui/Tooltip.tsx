import { cloneElement, useEffect, useId, useRef, useState, type HTMLAttributes, type ReactElement, type ReactNode } from "react";

type TooltipProps = {
  children: ReactElement;
  content: ReactNode;
  delayMs?: number;
};

export function Tooltip({ children, content, delayMs = 500 }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const timer = useRef<number | undefined>(undefined);

  const clearOpenTimer = () => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
  };

  const scheduleOpen = () => {
    clearOpenTimer();
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      setOpen(true);
    }, delayMs);
  };

  const close = () => {
    clearOpenTimer();
    setOpen(false);
  };

  useEffect(() => clearOpenTimer, []);

  const child = children as ReactElement<HTMLAttributes<HTMLElement>>;
  const describedBy = [child.props["aria-describedby"], open ? tooltipId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <span className="tooltip-anchor">
      {cloneElement(child, {
        "aria-describedby": describedBy,
        onBlur: (event: React.FocusEvent<HTMLElement>) => {
          child.props.onBlur?.(event);
          close();
        },
        onFocus: (event: React.FocusEvent<HTMLElement>) => {
          child.props.onFocus?.(event);
          scheduleOpen();
        },
        onMouseDown: (event: React.MouseEvent<HTMLElement>) => {
          child.props.onMouseDown?.(event);
          close();
        },
        onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
          child.props.onMouseEnter?.(event);
          scheduleOpen();
        },
        onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
          child.props.onMouseLeave?.(event);
          close();
        },
      })}
      {open ? <span className="tooltip" id={tooltipId} role="tooltip">{content}</span> : null}
    </span>
  );
}
