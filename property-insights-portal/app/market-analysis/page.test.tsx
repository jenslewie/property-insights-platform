import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import MarketAnalysisPage, { metadata } from "./page";

test("renders the market analysis page and its phase status", () => {
  render(<MarketAnalysisPage />);

  expect(
    screen.getByRole("heading", {
      level: 1,
      name: "Property Market Analysis",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "This application will be implemented with the Java market-analysis service in the next project phase.",
    ),
  ).toBeInTheDocument();
});

test("exports the market analysis page title metadata", () => {
  expect(metadata.title).toBe("Market Analysis");
});
