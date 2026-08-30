import { render, screen } from "@testing-library/react";
import { Icon, type IconName } from "./Icons";

const iconNames: IconName[] = [
  "settings", "help", "more", "account", "meeting", "history", "microphone",
  "microphoneOff", "camera", "cameraOff", "captions", "events", "info", "close",
  "leave", "back", "pin", "expand", "devices", "check", "warning", "loading",
];

test("renders every catalog icon as a local 24px SVG", () => {
  render(
    <div>
      {iconNames.map((name) => <Icon key={name} name={name} />)}
    </div>,
  );

  expect(screen.getAllByTestId("ui-icon")).toHaveLength(iconNames.length);
  for (const icon of screen.getAllByTestId("ui-icon")) {
    expect(icon.tagName).toBe("svg");
    expect(icon).toHaveAttribute("viewBox", "0 0 24 24");
    expect(icon).toHaveAttribute("width", "24");
    expect(icon).toHaveAttribute("height", "24");
  }
});

test("allows an explicit icon size", () => {
  render(<Icon name="settings" size={32} />);

  expect(screen.getByTestId("ui-icon")).toHaveAttribute("width", "32");
});
