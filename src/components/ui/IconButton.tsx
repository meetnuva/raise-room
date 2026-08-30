import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icons";
import { Tooltip } from "./Tooltip";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: IconName;
  label: string;
  tone?: "default" | "inverse" | "danger";
  selected?: boolean;
  tooltipDelayMs?: number;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  className,
  icon,
  label,
  selected,
  tone = "default",
  tooltipDelayMs,
  type = "button",
  ...buttonProps
}, ref) {
  const classes = [
    "icon-button",
    `icon-button--${tone}`,
    selected ? "is-selected" : "",
    className ?? "",
  ].filter(Boolean).join(" ");

  return (
    <Tooltip content={label} delayMs={tooltipDelayMs}>
      <button
        {...buttonProps}
        aria-label={label}
        aria-pressed={selected}
        className={classes}
        data-selected={selected || undefined}
        ref={ref}
        type={type}
      >
        <Icon name={icon} size={20} />
      </button>
    </Tooltip>
  );
});
