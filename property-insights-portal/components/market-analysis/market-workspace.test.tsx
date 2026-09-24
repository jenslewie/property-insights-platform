import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { MarketWorkspace } from "./market-workspace";
import type { MarketDashboardData } from "@/lib/market-analysis/server-api";
import type { PropertyRecord } from "@/lib/market-analysis/schemas";

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

test("keeps the selected baseline during local table search and clears it when segment filters exclude it", async () => {
  const user = userEvent.setup();
  const data = dashboard();
  const { rerender } = render(
    <MarketWorkspace data={data} filters={{}} dimension="square_footage" />,
  );

  await user.click(
    screen.getByRole("button", { name: "Compare price impact for property 1" }),
  );
  expect(screen.getByText("Selected property #1")).toBeInTheDocument();
  expect(screen.getByLabelText("Bedrooms")).toHaveValue(3);

  await user.type(screen.getByLabelText("Search properties"), "250000");
  expect(screen.getByText("Selected property #1")).toBeInTheDocument();

  rerender(
    <MarketWorkspace
      data={data}
      filters={{ min_price: 200001 }}
      dimension="square_footage"
    />,
  );
  expect(screen.queryByText("Selected property #1")).not.toBeInTheDocument();
  expect(
    screen.getByText("Select a sample property to compare."),
  ).toBeInTheDocument();
});

test("clears an active price impact result when segment filters remove the selected property", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      baseline: {
        square_footage: 1501,
        bedrooms: 3,
        bathrooms: 2,
        year_built: 1991,
        lot_size: 6001,
        distance_to_city_center: 4,
        school_rating: 7,
      },
      changes: { square_footage: { from: 1501, to: 1600 } },
      baseline_predicted_price: 400000,
      scenario_predicted_price: 410000,
      absolute_change: 10000,
      percentage_change: 2.5,
    }),
  );
  const data = dashboard();
  const { rerender } = render(
    <MarketWorkspace data={data} filters={{}} dimension="square_footage" />,
  );

  await user.click(
    screen.getByRole("button", { name: "Compare price impact for property 1" }),
  );
  await user.clear(screen.getByLabelText("Square footage"));
  await user.type(screen.getByLabelText("Square footage"), "1600");
  await user.click(
    screen.getByRole("button", { name: "Compare price impact" }),
  );
  expect(
    await screen.findByText("Model prediction results"),
  ).toBeInTheDocument();

  rerender(
    <MarketWorkspace
      data={data}
      filters={{ min_price: 200001 }}
      dimension="square_footage"
    />,
  );

  expect(
    screen.queryByText("Model prediction results"),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Square footage")).not.toBeInTheDocument();
  expect(
    screen.getByText("Select a sample property to compare."),
  ).toBeInTheDocument();
});

test("a zero-match segment has no selectable property or comparison form", () => {
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

  render(
    <MarketWorkspace
      data={data}
      filters={{ min_price: 999999 }}
      dimension="square_footage"
    />,
  );

  expect(
    screen.getByText("No properties match the current table filters."),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /compare price impact/i }),
  ).not.toBeInTheDocument();
  const workspace = screen.getByRole("region", {
    name: /price impact workspace/i,
  });
  expect(
    within(workspace).getByText("Select a sample property to compare."),
  ).toBeInTheDocument();
  expect(within(workspace).queryByRole("form")).not.toBeInTheDocument();
});

test("keeps export bounds aligned with the table after local search and sort", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:sample"),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response("id,price\n", { headers: { "Content-Type": "text/csv" } }),
    );
  const data = dashboard();
  render(
    <MarketWorkspace
      data={data}
      filters={{ min_price: 200000 }}
      dimension="bedrooms"
    />,
  );

  expect(screen.getByText("2 properties in this segment.")).toBeInTheDocument();
  await user.type(screen.getByLabelText("Search properties"), "250000");
  expect(
    screen.getByText("1 property shown of 2 in this segment."),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Sort by price" }));
  await user.click(screen.getByRole("button", { name: "Export segment CSV" }));

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/market-analysis/export?type=data&format=csv&min_price=200000",
  );
});
