import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { MarketWorkspace } from "./market-workspace";
import type { MarketDashboardData } from "@/lib/market-analysis/server-api";
import type { PropertyRecord } from "@/lib/market-analysis/schemas";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

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

test("shows market-level what-if controls separately from the source property table", () => {
  render(
    <MarketWorkspace
      data={dashboard()}
      filters={{}}
      scenario={undefined}
      dimension="square_footage"
    />,
  );

  expect(
    screen.getByRole("heading", { name: "Market what-if analysis" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("School rating change")).toHaveValue(null);
  expect(screen.getByLabelText("Square footage change (%)")).toHaveValue(null);
  expect(
    screen.getByRole("table", { name: /property records/i }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", {
      name: /compare price impact for property/i,
    }),
  ).not.toBeInTheDocument();
});

test("a zero-match segment disables scenario application", () => {
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
      scenario={undefined}
      dimension="square_footage"
    />,
  );

  expect(
    screen.getByText("No properties match the current table filters."),
  ).toBeInTheDocument();
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
  await user.click(screen.getByRole("button", { name: "Export segment CSV" }));

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/market-analysis/export?format=csv&min_price=200000",
  );
});
