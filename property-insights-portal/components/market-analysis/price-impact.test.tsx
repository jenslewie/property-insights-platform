import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { PriceImpact } from "./price-impact";
import type { MarketScenario } from "@/lib/market-analysis/filters";
import type { SegmentFilters } from "@/lib/market-analysis/fields";

function result(mean: number, percentageChange: number | null = 10) {
  const metrics = {
    mean,
    median: mean - 1,
    minimum: mean - 2,
    maximum: mean + 2,
  };
  return {
    property_count: 2,
    baseline: metrics,
    scenario: {
      mean: mean + 10,
      median: mean + 9,
      minimum: mean + 8,
      maximum: mean + 12,
    },
    impact: {
      mean: { absolute_change: 10, percentage_change: percentageChange },
      median: { absolute_change: 10, percentage_change: percentageChange },
      minimum: { absolute_change: 10, percentage_change: percentageChange },
      maximum: { absolute_change: 10, percentage_change: percentageChange },
    },
  };
}

function renderImpact(
  scenario: MarketScenario | undefined = { schoolRatingDelta: 1 },
  filters: SegmentFilters = { min_bedrooms: 3 },
  propertyCount = 2,
  dimension: "bedrooms" | "square_footage" = "bedrooms",
) {
  return render(
    <PriceImpact
      dimension={dimension}
      filters={filters}
      propertyCount={propertyCount}
      scenario={scenario}
    />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("shows the mean prediction first and keeps all four metrics collapsed", async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json(result(100)));
  renderImpact({
    schoolRatingDelta: 1,
    squareFootagePercent: 5,
    bedroomsDelta: 1,
    bathroomsDelta: 0.5,
    yearBuiltDelta: 5,
    lotSizeDelta: 500,
    distanceToCityCenterDelta: 0.5,
  });

  expect(
    await screen.findByRole("heading", {
      name: "What-if impact",
    }),
  ).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/market-analysis/price-impact",
    expect.objectContaining({
      method: "POST",
      cache: "no-store",
      body: JSON.stringify({
        filters: { min_bedrooms: 3 },
        scenario: {
          adjustments: {
            school_rating_delta: 1,
            square_footage_percent: 5,
            bedrooms_delta: 1,
            bathrooms_delta: 0.5,
            year_built_delta: 5,
            lot_size_delta: 500,
            distance_to_city_center_delta: 0.5,
          },
        },
      }),
    }),
  );
  expect(
    screen.getByText("Average predicted market price"),
  ).toBeInTheDocument();
  expect(screen.getByText("Predicted baseline: 100")).toBeInTheDocument();
  expect(screen.getByText("Predicted scenario: 110")).toBeInTheDocument();
  expect(screen.getByText("Absolute change: +10")).toBeInTheDocument();
  expect(screen.getByText("Percent change: +10%")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "View all predicted metrics" }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();

  await user.click(
    screen.getByRole("button", { name: "View all predicted metrics" }),
  );
  expect(
    screen.getByRole("table", { name: "All predicted metrics" }),
  ).toBeInTheDocument();
  expect(screen.getAllByText("+10")).toHaveLength(4);
});

test("shows an unavailable percentage when a predicted baseline is zero", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json(result(0, null)),
  );
  renderImpact();

  expect(
    await screen.findByText("Percent change: Unavailable"),
  ).toBeInTheDocument();
});

test("does not render impact or request predictions without an applied scenario", () => {
  const fetchMock = vi.spyOn(globalThis, "fetch");
  render(
    <PriceImpact
      dimension="bedrooms"
      filters={{ min_bedrooms: 3 }}
      propertyCount={2}
      scenario={undefined}
    />,
  );

  expect(
    screen.queryByRole("heading", { name: "Model predicted market prices" }),
  ).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("keeps the impact section separate from drawer controls", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(result(100)));
  renderImpact();

  expect(
    await screen.findByRole("heading", {
      name: "What-if impact",
    }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Apply scenario" }),
  ).not.toBeInTheDocument();
});

test("ignores a late prediction response for older applied conditions", async () => {
  const resolvers: Array<(response: Response) => void> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(
    () => new Promise((resolve) => resolvers.push(resolve)),
  );
  const { rerender } = renderImpact({ schoolRatingDelta: 1 });
  await waitFor(() => expect(resolvers).toHaveLength(1));

  rerender(
    <PriceImpact
      dimension="bedrooms"
      filters={{ min_bedrooms: 4 }}
      propertyCount={2}
      scenario={{ schoolRatingDelta: 2 }}
    />,
  );
  await waitFor(() => expect(resolvers).toHaveLength(2));

  await act(async () => resolvers[1](Response.json(result(200))));
  expect(
    await screen.findByText("Predicted baseline: 200"),
  ).toBeInTheDocument();
  await act(async () => resolvers[0](Response.json(result(100))));
  await waitFor(() => {
    expect(screen.getByText("Predicted baseline: 200")).toBeInTheDocument();
    expect(
      screen.queryByText("Predicted baseline: 100"),
    ).not.toBeInTheDocument();
  });
});

test("changing only the chart dimension does not repeat scenario predictions", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json(result(100)));
  const props = {
    filters: { min_bedrooms: 3 },
    propertyCount: 2,
    scenario: { schoolRatingDelta: 1 },
  };
  const view = render(<PriceImpact dimension="bedrooms" {...props} />);
  await screen.findByRole("heading", { name: "What-if impact" });

  view.rerender(<PriceImpact dimension="square_footage" {...props} />);

  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("clears pending predictions when the matched count becomes zero", async () => {
  let resolveRequest: (response: Response) => void = () => {
    throw new Error("Prediction request was not started.");
  };
  vi.spyOn(globalThis, "fetch").mockImplementation(
    () => new Promise((resolve) => (resolveRequest = resolve)),
  );
  const view = renderImpact();
  expect(
    await screen.findByText("Calculating market predictions…"),
  ).toBeInTheDocument();

  view.rerender(
    <PriceImpact
      dimension="bedrooms"
      filters={{ min_bedrooms: 3 }}
      propertyCount={0}
      scenario={{ schoolRatingDelta: 1 }}
    />,
  );
  expect(
    screen.getByText(/no properties match this segment/i),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("Calculating market predictions…"),
  ).not.toBeInTheDocument();

  await act(async () => resolveRequest(Response.json(result(100))));
  expect(screen.queryByText("Predicted baseline: 100")).not.toBeInTheDocument();
});

test("hides prior prediction errors when the matched count becomes zero", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json(
      { error: "Prediction service unavailable." },
      { status: 503 },
    ),
  );
  const view = renderImpact();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Prediction service unavailable.",
  );

  view.rerender(
    <PriceImpact
      dimension="bedrooms"
      filters={{ min_bedrooms: 3 }}
      propertyCount={0}
      scenario={{ schoolRatingDelta: 1 }}
    />,
  );

  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
