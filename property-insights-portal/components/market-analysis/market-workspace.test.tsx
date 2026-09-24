import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { MarketWorkspace } from "./market-workspace";
import type { MarketDashboardData } from "@/lib/market-analysis/server-api";
import type { PropertyRecord } from "@/lib/market-analysis/schemas";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  push.mockReset();
  window.history.replaceState(null, "", "/market-analysis");
});

function property(id: number, price: number): PropertyRecord {
  return {
    id,
    square_footage: 1500 + id,
    bedrooms: 3,
    bathrooms: 2,
    year_built: 1990 + id,
    lot_size: 6000 + id,
    distance_to_city_center: 4,
    school_rating: 7,
    price,
  };
}

function dashboard(
  properties = [property(1, 200000), property(2, 250000)],
): MarketDashboardData {
  const distribution = {
    dimension: "price" as const,
    matched_count: 2,
    buckets: [
      {
        key: "all",
        label: "All prices",
        min_inclusive: null,
        max_exclusive: null,
        exact_value: null,
        count: 2,
        average_price: 225000,
      },
    ],
  };
  return {
    properties: { count: properties.length, properties },
    summary: {
      total_count: 2,
      matched_count: 2,
      price: { mean: 225000, median: 225000, minimum: 200000, maximum: 250000 },
    },
    priceDistribution: distribution,
    featureDistribution: { ...distribution, dimension: "square_footage" },
  };
}

function impactResponse() {
  return {
    property_count: 2,
    baseline: { mean: 100, median: 99, minimum: 98, maximum: 102 },
    scenario: { mean: 110, median: 109, minimum: 108, maximum: 112 },
    impact: {
      mean: { absolute_change: 10, percentage_change: 10 },
      median: { absolute_change: 10, percentage_change: 10 },
      minimum: { absolute_change: 10, percentage_change: 10 },
      maximum: { absolute_change: 10, percentage_change: 10 },
    },
  };
}

function featureResult(dimension: "bedrooms" | "bathrooms" | "square_footage") {
  return {
    dimension,
    matched_count: 2,
    buckets: [
      {
        key: "all",
        label: "All",
        min_inclusive: null,
        max_exclusive: null,
        exact_value: null,
        count: 2,
        average_price: 225000,
      },
    ],
  };
}

test("shows market-level what-if controls separately from the source property table", async () => {
  const user = userEvent.setup();
  render(
    <MarketWorkspace
      data={dashboard()}
      filters={{}}
      scenario={undefined}
      dimension="square_footage"
    />,
  );

  expect(
    screen.queryByRole("heading", { name: "Market what-if analysis" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "What-if impact" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "What-if scenario" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Filters (0)" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Historical market overview" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  expect(
    screen.getByText("2 / 2 properties match this segment."),
  ).toBeInTheDocument();
  const filtersButton = screen.getByRole("button", { name: "Filters (0)" });
  const scenarioButton = screen.getByRole("button", {
    name: "What-if scenario",
  });
  const exportButton = screen.getByRole("button", { name: "Export" });
  expect(
    filtersButton.compareDocumentPosition(scenarioButton) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    scenarioButton.compareDocumentPosition(exportButton) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    screen.getByRole("combobox", { name: "Feature for second chart" }),
  ).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "What-if scenario" }));
  expect(screen.getByLabelText("School rating change")).toHaveValue(null);
  expect(screen.getByLabelText("Square footage change (%)")).toHaveValue(null);
  expect(screen.getByRole("button", { name: "Apply scenario" })).toBeDisabled();
  expect(
    screen.getByRole("table", { name: /property records/i }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", {
      name: /compare price impact for property/i,
    }),
  ).not.toBeInTheDocument();
  expect(
    within(
      screen.getByRole("dialog", { name: "What-if scenario" }),
    ).queryByRole("combobox", { name: "Feature for second chart" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Filters (0)" }));
  expect(
    within(screen.getByRole("dialog", { name: "Filters" })).queryByRole(
      "combobox",
      { name: "Feature for second chart" },
    ),
  ).not.toBeInTheDocument();
});

test("Edit scenario opens the applied scenario drawer without removing impact", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json(impactResponse()),
  );

  render(
    <MarketWorkspace
      data={dashboard()}
      filters={{}}
      scenario={{ schoolRatingDelta: 1 }}
      dimension="square_footage"
    />,
  );
  expect(
    await screen.findByText("Predicted baseline: 100"),
  ).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Edit scenario" }));

  expect(
    screen.getByRole("dialog", { name: "What-if scenario" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("School rating change")).toHaveValue(1);
  expect(screen.getByText("Predicted baseline: 100")).toBeInTheDocument();
});

test("scenario application updates only the prediction request boundary", async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json(impactResponse()));
  render(
    <MarketWorkspace
      data={dashboard()}
      filters={{}}
      scenario={undefined}
      dimension="square_footage"
    />,
  );

  await user.click(screen.getByRole("button", { name: "What-if scenario" }));
  await user.type(screen.getByLabelText("School rating change"), "1");
  await user.click(screen.getByRole("button", { name: "Apply scenario" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/market-analysis/price-impact",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        filters: {},
        scenario: { adjustments: { school_rating_delta: 1 } },
      }),
    }),
  );
  expect(window.location.search).toContain("scenario_school_rating_delta=1");
  expect(
    fetchMock.mock.calls.some((call) =>
      String(call[0]).includes("/api/market-analysis/distribution"),
    ),
  ).toBe(false);

  await user.click(screen.getByRole("button", { name: "Edit scenario (1)" }));
  await user.click(screen.getByRole("button", { name: "Clear scenario" }));
  expect(window.location.search).not.toContain("scenario_school_rating_delta");
  expect(
    screen.queryByRole("heading", { name: "What-if impact" }),
  ).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("restores combined URL conditions and follows later history URL changes", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json(impactResponse()));
  const props = {
    data: {
      ...dashboard(),
      featureDistribution: {
        ...dashboard().featureDistribution,
        dimension: "bedrooms" as const,
      },
    },
    filters: { min_bedrooms: 3 },
    scenario: { schoolRatingDelta: 1 },
    dimension: "bedrooms" as const,
  };
  window.history.replaceState(
    null,
    "",
    "/market-analysis?min_bedrooms=3&scenario_school_rating_delta=1&chart_dimension=bedrooms",
  );
  const view = render(<MarketWorkspace {...props} />);

  expect(
    screen.getByRole("button", { name: "Filters (1)" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Edit scenario (1)" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("combobox", { name: "Feature for second chart" }),
  ).toHaveValue("bedrooms");
  expect(
    await screen.findByText("Predicted baseline: 100"),
  ).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(String(fetchMock.mock.calls[0][0])).toBe(
    "/api/market-analysis/price-impact",
  );

  window.history.replaceState(
    null,
    "",
    "/market-analysis?min_bedrooms=3&chart_dimension=bedrooms",
  );
  view.rerender(<MarketWorkspace {...props} />);

  expect(
    screen.getByRole("button", { name: "What-if scenario" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "What-if impact" }),
  ).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("keeps the scenario drawer closed after history leaves and returns to its conditions", async () => {
  const user = userEvent.setup();
  const props = {
    data: dashboard(),
    filters: {},
    scenario: undefined,
    dimension: "square_footage" as const,
  };
  const view = render(<MarketWorkspace {...props} />);
  const trigger = screen.getByRole("button", { name: "What-if scenario" });

  await user.click(trigger);
  expect(
    screen.getByRole("dialog", { name: "What-if scenario" }),
  ).toBeInTheDocument();

  window.history.replaceState(null, "", "/market-analysis?min_bedrooms=4");
  view.rerender(<MarketWorkspace {...props} />);
  expect(
    screen.queryByRole("dialog", { name: "What-if scenario" }),
  ).not.toBeInTheDocument();

  window.history.replaceState(null, "", "/market-analysis");
  view.rerender(<MarketWorkspace {...props} />);
  expect(
    screen.queryByRole("dialog", { name: "What-if scenario" }),
  ).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test("chart selection updates the URL and requests only the selected feature distribution", async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json(featureResult("bedrooms")));
  const props = {
    data: dashboard(),
    filters: { min_price: 200000 },
    scenario: undefined,
    dimension: "square_footage" as const,
  };
  const view = render(<MarketWorkspace {...props} />);

  await user.selectOptions(
    screen.getByRole("combobox", { name: "Feature for second chart" }),
    "bedrooms",
  );
  expect(window.location.search).toContain("chart_dimension=bedrooms");
  view.rerender(<MarketWorkspace {...props} />);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/market-analysis/distribution?min_price=200000&dimension=bedrooms",
    expect.objectContaining({ cache: "no-store" }),
  );
  expect(screen.getByText("Mean historical price")).toBeInTheDocument();
  expect(
    fetchMock.mock.calls.some((call) =>
      String(call[0]).includes("/api/market-analysis/price-impact"),
    ),
  ).toBe(false);
});

test("ignores a late feature response after a newer chart selection", async () => {
  const user = userEvent.setup();
  const resolvers: Array<(response: Response) => void> = [];
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      () => new Promise((resolve) => resolvers.push(resolve)),
    );
  const props = {
    data: dashboard(),
    filters: {},
    scenario: undefined,
    dimension: "square_footage" as const,
  };
  const view = render(<MarketWorkspace {...props} />);

  await user.selectOptions(
    screen.getByRole("combobox", { name: "Feature for second chart" }),
    "bedrooms",
  );
  view.rerender(<MarketWorkspace {...props} />);
  await waitFor(() => expect(resolvers).toHaveLength(1));

  await user.selectOptions(
    screen.getByRole("combobox", { name: "Feature for second chart" }),
    "bathrooms",
  );
  view.rerender(<MarketWorkspace {...props} />);
  await waitFor(() => expect(resolvers).toHaveLength(2));

  await act(async () =>
    resolvers[1](Response.json(featureResult("bathrooms"))),
  );
  expect(
    await screen.findByRole("heading", { name: "Bathrooms distribution" }),
  ).toBeInTheDocument();
  await act(async () => resolvers[0](Response.json(featureResult("bedrooms"))));

  expect(
    screen.getByRole("heading", { name: "Bathrooms distribution" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Bedrooms distribution" }),
  ).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("a zero-match segment disables scenario application", async () => {
  const data = dashboard();
  data.summary = {
    total_count: 2,
    matched_count: 0,
    price: { mean: null, median: null, minimum: null, maximum: null },
  };
  data.priceDistribution = {
    ...data.priceDistribution,
    matched_count: 0,
    buckets: data.priceDistribution.buckets.map((bucket) => ({
      ...bucket,
      count: 0,
      average_price: null,
    })),
  };
  data.featureDistribution = {
    ...data.featureDistribution,
    matched_count: 0,
    buckets: data.featureDistribution.buckets.map((bucket) => ({
      ...bucket,
      count: 0,
      average_price: null,
    })),
  };

  const user = userEvent.setup();
  render(
    <MarketWorkspace
      data={data}
      filters={{ min_price: 999999 }}
      scenario={undefined}
      dimension="square_footage"
    />,
  );

  expect(
    screen.getByText("No properties match the current table filters."),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "What-if scenario" }));
  expect(screen.getByRole("button", { name: "Apply scenario" })).toBeDisabled();
  expect(
    screen.getByText(/scenario analysis is unavailable/i),
  ).toBeInTheDocument();
});

test("local table search, sorting, and pagination do not change applied analysis conditions", async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response("id,price\n", { headers: { "Content-Type": "text/csv" } }),
    );
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:sample"),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

  render(
    <MarketWorkspace
      data={dashboard()}
      filters={{ min_price: 200000 }}
      scenario={undefined}
      dimension="bedrooms"
    />,
  );

  expect(screen.getByText("2 properties in this segment.")).toBeInTheDocument();
  await user.type(screen.getByLabelText("Search properties"), "250000");
  expect(
    screen.getByText("1 property shown of 2 in this segment."),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Sort by price" }));
  await user.click(screen.getByRole("button", { name: "Export" }));
  await user.click(screen.getByRole("menuitem", { name: /Properties CSV/ }));

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/market-analysis/export?format=csv&min_price=200000",
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("does not calculate impact with a count from a different filter segment", async () => {
  const user = userEvent.setup();
  window.history.replaceState(
    null,
    "",
    "/market-analysis?min_bedrooms=4&scenario_school_rating_delta=1",
  );
  const fetchMock = vi.spyOn(globalThis, "fetch");
  const view = render(
    <MarketWorkspace
      data={dashboard()}
      filters={{}}
      scenario={undefined}
      dimension="square_footage"
    />,
  );

  expect(
    screen.queryByRole("heading", { name: "What-if impact" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Edit scenario (1)" }),
  ).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("button", { name: "Export" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await user.click(screen.getByRole("button", { name: "Edit scenario (1)" }));
  await user.click(screen.getByRole("button", { name: "Export" }));
  expect(
    screen.queryByRole("dialog", { name: "What-if scenario" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(
    screen.getByText("Updating dashboard for the selected filters…"),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Historical market overview" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("table", { name: /property records/i }),
  ).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();

  const empty = dashboard([]);
  empty.summary = {
    total_count: 2,
    matched_count: 0,
    price: { mean: null, median: null, minimum: null, maximum: null },
  };
  empty.priceDistribution = {
    ...empty.priceDistribution,
    matched_count: 0,
    buckets: empty.priceDistribution.buckets.map((bucket) => ({
      ...bucket,
      count: 0,
      average_price: null,
    })),
  };
  empty.featureDistribution = {
    ...empty.featureDistribution,
    matched_count: 0,
    buckets: empty.featureDistribution.buckets.map((bucket) => ({
      ...bucket,
      count: 0,
      average_price: null,
    })),
  };
  view.rerender(
    <MarketWorkspace
      data={empty}
      filters={{ min_bedrooms: 4 }}
      scenario={{ schoolRatingDelta: 1 }}
      dimension="square_footage"
    />,
  );

  expect(
    await screen.findByText(
      "No properties match this segment, so no predicted impact is available.",
    ),
  ).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});
