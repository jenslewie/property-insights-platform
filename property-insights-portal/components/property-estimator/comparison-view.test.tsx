import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import type { EstimateRecord } from "@/lib/types";
import { ComparisonView } from "./comparison-view";

const estimate: EstimateRecord = {
  id: "internal-one",
  display_number: 17,
  created_at: "2026-09-24T10:00:00.000Z",
  property: {
    square_footage: 1550,
    bedrooms: 3,
    bathrooms: 2,
    year_built: 1997,
    lot_size: 6800,
    distance_to_city_center: 4.1,
    school_rating: 7.6,
  },
  predicted_price: 250879.73,
};

const secondEstimate: EstimateRecord = {
  ...estimate,
  id: "internal-two",
  display_number: 18,
  property: {
    square_footage: 2200,
    bedrooms: 4,
    bathrooms: 2.5,
    year_built: 2008,
    lot_size: 9600,
    distance_to_city_center: 7,
    school_rating: 8.8,
  },
  predicted_price: 364551.64,
};

test("renders a separate price chart and an estimate-by-feature comparison matrix", () => {
  render(<ComparisonView estimates={[estimate, secondEstimate]} />);

  const comparison = screen.getByRole("region", {
    name: "Property comparison",
  });
  expect(
    within(comparison).getByRole("heading", { name: "Price comparison" }),
  ).toBeInTheDocument();
  expect(
    within(comparison).getByRole("img", {
      name: "Bar chart comparing predicted property prices. Estimate #17, Estimate #18",
    }),
  ).toBeInTheDocument();

  const table = within(comparison).getByRole("table", {
    name: "Side-by-side property comparison",
  }) as HTMLTableElement;
  expect(table).toHaveClass("xl:table-fixed");
  expect(table.parentElement).not.toHaveClass("overflow-x-auto");
  expect(table.tHead).toHaveClass("xl:not-sr-only");
  expect(table.tBodies[0]).toHaveClass("block", "xl:table-row-group");
  expect(within(table).getAllByRole("row")).toHaveLength(9);
  expect(
    within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent),
  ).toEqual(["Feature", "Estimate #17", "Estimate #18"]);
  expect(
    within(table).getByRole("rowheader", { name: "Predicted price" }),
  ).toBeInTheDocument();
  expect(within(table).getByText("250,879.73")).toBeInTheDocument();
  expect(within(table).getByText("364,551.64")).toBeInTheDocument();
  expect(
    within(table).getByRole("rowheader", { name: "Square footage" }),
  ).toBeInTheDocument();
  expect(
    within(table).getByRole("rowheader", { name: "School rating" }),
  ).toBeInTheDocument();
  const mobilePriceRow = within(table).getByRole("row", {
    name: /Predicted price/,
  });
  expect(mobilePriceRow).toHaveClass("grid", "grid-cols-2", "xl:table-row");
  expect(
    Array.from(mobilePriceRow.querySelectorAll("td"), (cell) =>
      cell.getAttribute("data-label"),
    ),
  ).toEqual(["Estimate #17", "Estimate #18"]);
});

test("does not render outside the supported two-to-four estimate range", () => {
  const { rerender } = render(<ComparisonView estimates={[estimate]} />);

  expect(
    screen.queryByRole("region", { name: "Property comparison" }),
  ).not.toBeInTheDocument();

  rerender(
    <ComparisonView
      estimates={[
        estimate,
        secondEstimate,
        { ...estimate, id: "three", display_number: 19 },
        { ...estimate, id: "four", display_number: 20 },
        { ...estimate, id: "five", display_number: 21 },
      ]}
    />,
  );
  expect(
    screen.queryByRole("region", { name: "Property comparison" }),
  ).not.toBeInTheDocument();
});
