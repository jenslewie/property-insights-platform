import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { EstimateChart } from "./estimate-chart";

const record = {
  id: "estimate-1",
  created_at: "2026-09-22T10:00:00.000Z",
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

test("renders all seven property features and price for each selected record", () => {
  render(
    <EstimateChart
      records={[
        record,
        {
          ...record,
          id: "estimate-2",
          predicted_price: 310000,
        },
      ]}
    />,
  );

  expect(
    screen.getByRole("heading", { name: /price comparison/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("img", {
      name: /bar chart comparing predicted property prices/i,
    }),
  ).toBeInTheDocument();
  const comparison = screen.getByRole("table", {
    name: /selected property comparison/i,
  });

  expect(
    within(comparison)
      .getAllByRole("columnheader")
      .map((header) => header.textContent),
  ).toEqual([
    "Property",
    "Square footage",
    "Bedrooms",
    "Bathrooms",
    "Year built",
    "Lot size",
    "Distance to center",
    "School rating",
    "Predicted price",
  ]);

  const rows = within(comparison).getAllByRole("row");
  expect(
    within(rows[1])
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["1,550", "3", "2", "1997", "6,800", "4.1", "7.6", "250,879.73"]);
});
