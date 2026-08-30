import { render, screen } from "@testing-library/react";
import { NuvaBrand } from "./NuvaBrand";

test("renders the official lowercase nuva mark with Raise Room", () => {
  render(<NuvaBrand />);

  expect(screen.getByRole("img", { name: "nuva" })).toHaveAttribute(
    "src",
    "/brand/blue-nuva-logo.png",
  );
  expect(screen.getByText("Raise Room")).toBeVisible();
});
