import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { EstimateChart } from "./estimate-chart";

const records = [
  {
    id: "estimate-1",
    display_number: 108,
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
  },
  {
    id: "estimate-2",
    display_number: 109,
    created_at: "2026-09-22T10:01:00.000Z",
    property: {
      square_footage: 2200,
      bedrooms: 4,
      bathrooms: 2.5,
      year_built: 2008,
      lot_size: 9600,
      distance_to_city_center: 7,
      school_rating: 8.8,
    },
    predicted_price: 310000,
  },
];

test("renders a named chart using stable estimate labels only", () => {
  render(
    <EstimateChart
      chartLabel="Bar chart showing predicted property prices"
      records={records}
      title="Predicted price"
    />,
  );

  expect(
    screen.getByRole("heading", { name: "Predicted price" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("img", {
      name: /Bar chart showing predicted property prices.*Estimate #108.*Estimate #109/,
    }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});
