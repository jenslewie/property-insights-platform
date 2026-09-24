import { createElement, type ComponentType } from "react";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

type Props = {
  estimates: Array<{
    id: string;
    display_number: number;
    created_at: string;
    property: {
      square_footage: number;
      bedrooms: number;
      bathrooms: number;
      year_built: number;
      lot_size: number;
      distance_to_city_center: number;
      school_rating: number;
    };
    predicted_price: number;
  }>;
  mode: "single" | "batch";
};

const estimate = {
  id: "estimate-108",
  display_number: 108,
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

const secondEstimate = {
  ...estimate,
  id: "estimate-109",
  display_number: 109,
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

async function loadPredictionResults() {
  const loadedModule = await import("./prediction-results");
  return Reflect.get(loadedModule, "PredictionResults") as
    ComponentType<Props> | undefined;
}

test("shows one Single prediction as a chart and one-row feature table", async () => {
  const PredictionResults = await loadPredictionResults();
  expect(PredictionResults).toBeDefined();
  if (!PredictionResults) return;

  render(
    createElement(PredictionResults, { estimates: [estimate], mode: "single" }),
  );

  expect(
    screen.getByRole("region", { name: "Prediction results" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/latest estimate · estimate #108/i),
  ).toBeInTheDocument();
  expect(screen.getByText("Predicted value")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Predicted price" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("img", {
      name: /Bar chart showing predicted property prices.*Estimate #108/,
    }),
  ).toBeInTheDocument();

  const table = screen.getByRole("table", {
    name: "Prediction results",
  }) as HTMLTableElement;
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  expect(table).toHaveClass("xl:table-fixed");
  expect(table.parentElement).not.toHaveClass("overflow-x-auto");
  expect(table.tHead).toHaveClass("xl:not-sr-only");
  expect(table.tBodies[0]).toHaveClass("block", "xl:table-row-group");
  expect(
    within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent),
  ).toEqual([
    "Estimate",
    "Square footage",
    "Bedrooms",
    "Bathrooms",
    "Year built",
    "Lot size",
    "Distance to city center",
    "School rating",
    "Predicted price",
  ]);
  expect(within(table).getByText("Estimate #108")).toBeInTheDocument();
  expect(within(table).getByText("250,879.73")).toBeInTheDocument();
  const resultRow = within(table).getByRole("row", { name: /Estimate #108/ });
  expect(resultRow).toHaveClass("grid", "xl:table-row");
  expect(
    Array.from(resultRow.querySelectorAll("td"), (cell) =>
      cell.getAttribute("data-label"),
    ),
  ).toEqual([
    "Square footage",
    "Bedrooms",
    "Bathrooms",
    "Year built",
    "Lot size",
    "Distance to city center",
    "School rating",
    "Predicted price",
  ]);
});

test("shows a one-property Batch with batch context, chart, and table", async () => {
  const PredictionResults = await loadPredictionResults();
  expect(PredictionResults).toBeDefined();
  if (!PredictionResults) return;

  render(
    createElement(PredictionResults, { estimates: [estimate], mode: "batch" }),
  );

  expect(screen.getByText("Latest batch · 1 estimate")).toBeInTheDocument();
  expect(
    screen.getByRole("img", {
      name: /Bar chart showing predicted property prices.*Estimate #108/,
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("table", { name: "Prediction results" }),
  ).toBeInTheDocument();
});

test("shows each Batch estimate with its stable numeric label", async () => {
  const PredictionResults = await loadPredictionResults();
  expect(PredictionResults).toBeDefined();
  if (!PredictionResults) return;

  render(
    createElement(PredictionResults, {
      estimates: [estimate, secondEstimate],
      mode: "batch",
    }),
  );

  const table = screen.getByRole("table", { name: "Prediction results" });
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  expect(within(table).getByText("Estimate #108")).toBeInTheDocument();
  expect(within(table).getByText("Estimate #109")).toBeInTheDocument();
  expect(
    screen.getByRole("img", {
      name: /Bar chart showing predicted property prices.*Estimate #108.*Estimate #109/,
    }),
  ).toBeInTheDocument();
});
