import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { EstimateResultView } from "./estimate-result";

const estimate = {
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

test("renders a currency-neutral estimate and submitted property details", () => {
  render(<EstimateResultView estimate={estimate} />);

  expect(
    screen.getByRole("heading", { name: /latest estimate/i }),
  ).toBeInTheDocument();
  expect(screen.getByText("250,879.73")).toBeInTheDocument();
  expect(screen.getByText("square footage")).toBeInTheDocument();
  expect(screen.getByText("1,550")).toBeInTheDocument();
});
