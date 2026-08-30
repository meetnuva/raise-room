import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { NuvaBrand } from "./NuvaBrand";

test("renders the official lowercase nuva mark with Raise Room", () => {
  render(<NuvaBrand />);

  expect(screen.getByRole("img", { name: "nuva" })).toHaveAttribute(
    "src",
    "/brand/blue-nuva-logo.png",
  );
  expect(screen.getByText("Raise Room")).toBeVisible();
});

test("hides only the nonessential brand text at the narrow home-header breakpoint", () => {
  const styles = readFileSync("src/styles.css", "utf8");
  const mobileRule = styles.match(/@media \(max-width: 30rem\)\s*\{([\s\S]*?)\n\}/)?.[1];

  expect(mobileRule).toBeDefined();
  expect(mobileRule).toMatch(/\.nuva-brand-divider,\s*\.nuva-brand-product\s*\{[^}]*display:\s*none;/s);
  expect(mobileRule).not.toMatch(/\.meet-home-header-actions\s*\{[^}]*display:\s*none;/s);
});
