import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

test("links to both portal applications", () => {
  render(<Home />);

  expect(
    screen.getByRole("link", {
      name: /open property value estimator/i,
    }),
  ).toHaveAttribute("href", "/property-estimator");

  expect(
    screen.getByRole("link", {
      name: /view market analysis/i,
    }),
  ).toHaveAttribute("href", "/market-analysis");
});
