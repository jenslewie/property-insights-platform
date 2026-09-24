import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { DistributionTooltip, MarketOverview } from "./market-overview";

const { xAxisProps } = vi.hoisted(() => ({ xAxisProps: vi.fn() }));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: (props: unknown) => {
    xAxisProps(props);
    return null;
  },
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

test("renders historical KPIs and two charts with independently collapsed bucket tables", async () => {
  const user = userEvent.setup();
  const onDimensionChange = vi.fn();
  render(
    <MarketOverview
      summary={summary}
      priceDistribution={priceDistribution}
      featureDistribution={featureDistribution}
      dimension="square_footage"
      featurePending={false}
      onRetryFeature={vi.fn()}
      onDimensionChange={onDimensionChange}
    />,
  );

  expect(
    screen.getByRole("heading", { name: "Historical market overview" }),
  ).toBeInTheDocument();
  for (const label of [
    "Mean historical price",
    "Median historical price",
    "Minimum historical price",
    "Maximum historical price",
  ]) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
  expect(screen.getAllByRole("img")).toHaveLength(2);
  expect(
    screen.getAllByRole("button", { name: /View bucket details/ }),
  ).toHaveLength(2);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(
    screen.getByText("No properties match this segment."),
  ).toBeInTheDocument();
  expect(screen.getByText("CSV sample historical prices")).toBeInTheDocument();

  const priceToggle = screen.getByRole("button", {
    name: "View bucket details for Price distribution",
  });
  const featureToggle = screen.getByRole("button", {
    name: "View bucket details for Square footage distribution",
  });
  expect(priceToggle).toHaveAttribute("aria-expanded", "false");
  await user.click(priceToggle);

  const priceTable = screen.getByRole("table", {
    name: "Price distribution values",
  });
  expect(priceTable).toBeInTheDocument();
  expect(within(priceTable).getAllByRole("row")).toHaveLength(3);
  expect(
    within(priceTable).getByRole("row", { name: /<200000 0/ }),
  ).toBeInTheDocument();
  expect(featureToggle).toHaveAttribute("aria-expanded", "false");
  expect(
    screen.queryByRole("table", { name: "Square footage distribution values" }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByText("—")).toHaveLength(7);
  expect(screen.queryByText("NaN")).not.toBeInTheDocument();
});

test("selects any of the seven features for the second chart", async () => {
  const user = userEvent.setup();
  const onDimensionChange = vi.fn();
  render(
    <MarketOverview
      summary={summary}
      priceDistribution={priceDistribution}
      featureDistribution={featureDistribution}
      dimension="square_footage"
      featurePending={false}
      onRetryFeature={vi.fn()}
      onDimensionChange={onDimensionChange}
    />,
  );

  const selector = screen.getByRole("combobox", {
    name: "Feature for second chart",
  });
  expect(within(selector).getAllByRole("option")).toHaveLength(7);
  await user.selectOptions(selector, "bedrooms");
  expect(onDimensionChange).toHaveBeenCalledWith("bedrooms");
});

test("shortens price bucket tick labels to readable K values", () => {
  xAxisProps.mockClear();
  render(
    <MarketOverview
      summary={summary}
      priceDistribution={priceDistribution}
      featureDistribution={featureDistribution}
      dimension="square_footage"
      featurePending={false}
      onRetryFeature={vi.fn()}
      onDimensionChange={vi.fn()}
    />,
  );

  const priceAxis = xAxisProps.mock.calls[0]?.[0] as
    { tickFormatter?: (value: string) => string } | undefined;
  expect(priceAxis?.tickFormatter).toEqual(expect.any(Function));
  expect(priceAxis?.tickFormatter?.("<200000")).toBe("<$200K");
  expect(priceAxis?.tickFormatter?.("200000–<250000")).toBe("$200K–<$250K");
  expect(priceAxis?.tickFormatter?.(">=350000")).toBe("≥$350K");
});

test("tooltips identify each bucket's property count and historical average", () => {
  render(
    <DistributionTooltip
      active
      payload={[{ payload: priceDistribution.buckets[0] }]}
    />,
  );

  expect(screen.getByText("<200000")).toBeInTheDocument();
  expect(screen.getByText("Properties: 0")).toBeInTheDocument();
  expect(screen.getByText("Average historical price: —")).toBeInTheDocument();
});

test("shows a local retry action when the selected feature distribution fails", async () => {
  const user = userEvent.setup();
  const onRetryFeature = vi.fn();
  render(
    <MarketOverview
      summary={summary}
      priceDistribution={priceDistribution}
      featureDistribution={null}
      dimension="bedrooms"
      featurePending={false}
      featureError="The feature distribution is unavailable."
      onRetryFeature={onRetryFeature}
      onDimensionChange={vi.fn()}
    />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent(
    "The feature distribution is unavailable.",
  );
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(onRetryFeature).toHaveBeenCalledOnce();
});
