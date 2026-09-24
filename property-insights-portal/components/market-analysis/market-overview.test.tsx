import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { MarketOverview } from "./market-overview";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Bar: () => null,
}));

const summary = {
  total_count: 50,
  matched_count: 0,
  price: { mean: null, median: null, minimum: null, maximum: null },
};

const priceDistribution = {
  dimension: "price" as const,
  matched_count: 0,
  buckets: [
    {
      key: "lt_200000",
      label: "<200000",
      min_inclusive: null,
      max_exclusive: 200000,
      exact_value: null,
      count: 0,
      average_price: null,
    },
    {
      key: "200000_250000",
      label: "200000–<250000",
      min_inclusive: 200000,
      max_exclusive: 250000,
      exact_value: null,
      count: 0,
      average_price: null,
    },
  ],
};

const featureDistribution = {
  dimension: "square_footage" as const,
  matched_count: 0,
  buckets: [
    {
      key: "lt_1200",
      label: "<1200",
      min_inclusive: null,
      max_exclusive: 1200,
      exact_value: null,
      count: 0,
      average_price: null,
    },
  ],
};

test("renders historical price cards, two fixed-bucket charts, and accessible data", () => {
  render(
    <MarketOverview
      summary={summary}
      priceDistribution={priceDistribution}
      featureDistribution={featureDistribution}
    />,
  );

  for (const label of [
    "Mean sample price",
    "Median sample price",
    "Minimum sample price",
    "Maximum sample price",
  ]) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
  expect(screen.getAllByText("—")).toHaveLength(7);
  expect(
    screen.getByRole("heading", { name: "Price distribution" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Square footage distribution" }),
  ).toBeInTheDocument();
  expect(screen.getByText("CSV sample historical prices")).toBeInTheDocument();

  const priceTable = screen.getByRole("table", {
    name: "Price distribution values",
  });
  expect(within(priceTable).getAllByRole("row")).toHaveLength(3);
  expect(
    within(priceTable).getByRole("row", { name: /<200000 0/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("No properties match this segment."),
  ).toBeInTheDocument();
  expect(screen.queryByText("NaN")).not.toBeInTheDocument();
});
