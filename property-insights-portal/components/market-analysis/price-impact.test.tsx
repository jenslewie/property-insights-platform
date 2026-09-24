import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PriceImpact } from "./price-impact";
import type { MarketScenario } from "@/lib/market-analysis/filters";
import type { SegmentFilters } from "@/lib/market-analysis/fields";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function result(mean: number) {
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
      mean: { absolute_change: 10, percentage_change: 10 },
      median: { absolute_change: 10, percentage_change: 10 },
      minimum: { absolute_change: 10, percentage_change: 10 },
      maximum: { absolute_change: 10, percentage_change: 10 },
    },
  };
}

function renderImpact(
  scenario: MarketScenario | undefined = undefined,
  filters: SegmentFilters = { min_bedrooms: 3 },
  propertyCount = 2,
) {
  return render(
    <PriceImpact
      dimension="bedrooms"
      filters={filters}
      propertyCount={propertyCount}
      scenario={scenario}
    />,
  );
}

beforeEach(() => {
  push.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("loads aggregate predictions from applied URL conditions", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json(result(100)));
  renderImpact({ schoolRatingDelta: 1, squareFootagePercent: 5 });

  expect(
    await screen.findByRole("heading", {
      name: "Model predicted market prices",
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
          },
        },
      }),
    }),
  );
  expect(screen.getByText("Predicted baseline")).toBeInTheDocument();
  expect(screen.getByText("Predicted scenario")).toBeInTheDocument();
  expect(screen.getAllByText("+10")).toHaveLength(4);
});

test("does not request predictions until a scenario is applied", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.spyOn(globalThis, "fetch");
  renderImpact();

  expect(fetchMock).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText("School rating change"), "1");
  await user.click(screen.getByRole("button", { name: "Apply scenario" }));

  expect(push).toHaveBeenCalledWith(
    "/market-analysis?min_bedrooms=3&scenario_school_rating_delta=1&chart_dimension=bedrooms",
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

test("reapplying unchanged conditions keeps the URL conditions unchanged", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(result(100)));
  renderImpact({ schoolRatingDelta: 1 });

  await user.click(screen.getByRole("button", { name: "Apply scenario" }));

  expect(push).toHaveBeenCalledWith(
    "/market-analysis?min_bedrooms=3&scenario_school_rating_delta=1&chart_dimension=bedrooms",
  );
  expect(push.mock.calls[0][0]).not.toContain("analysis_id");
  expect(push.mock.calls[0][0]).not.toContain("analysis_key");
});

test("applying a changed scenario commits it while retaining filters", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(result(100)));
  renderImpact({ schoolRatingDelta: 1 });

  await user.clear(screen.getByLabelText("School rating change"));
  await user.type(screen.getByLabelText("School rating change"), "2");
  await user.click(screen.getByRole("button", { name: "Apply scenario" }));

  expect(push).toHaveBeenCalledWith(
    "/market-analysis?min_bedrooms=3&scenario_school_rating_delta=2&chart_dimension=bedrooms",
  );
});

test("clears the applied scenario while preserving filters and chart dimension", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(result(100)));
  renderImpact({ schoolRatingDelta: 1 });

  await user.clear(screen.getByLabelText("School rating change"));
  await user.click(screen.getByRole("button", { name: "Apply scenario" }));

  expect(push).toHaveBeenCalledWith(
    "/market-analysis?min_bedrooms=3&chart_dimension=bedrooms",
  );
});

test("disables scenario application and avoids a request for an empty segment", () => {
  const fetchMock = vi.spyOn(globalThis, "fetch");
  renderImpact({ schoolRatingDelta: 1 }, { min_bedrooms: 10 }, 0);

  expect(screen.getByRole("button", { name: "Apply scenario" })).toBeDisabled();
  expect(screen.getByText(/no properties match/i)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
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
  expect(await screen.findByText("200")).toBeInTheDocument();
  await act(async () => resolvers[0](Response.json(result(100))));
  await waitFor(() => {
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.queryByText("100")).not.toBeInTheDocument();
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
  await screen.findByRole("heading", { name: "Model predicted market prices" });

  view.rerender(<PriceImpact dimension="square_footage" {...props} />);

  expect(fetchMock).toHaveBeenCalledTimes(1);
});
