import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Navigation } from "./navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/property-estimator",
}));

test("identifies the active application route", () => {
  render(<Navigation />);

  expect(
    screen.getByRole("link", {
      name: "Property Estimator",
    }),
  ).toHaveAttribute("aria-current", "page");

  expect(
    screen.getByRole("link", {
      name: "Home",
    }),
  ).not.toHaveAttribute("aria-current");

  expect(
    screen.getByRole("link", {
      name: "Market Analysis",
    }),
  ).toHaveAttribute("href", "/market-analysis");
});
