import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import MarketAnalysisPage, { metadata } from "./page";
import type { MarketDashboardData } from "@/lib/market-analysis/server-api";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/market-analysis/server-api", () => ({
  getMarketDashboard: vi.fn(),
}));

import { getMarketDashboard } from "@/lib/market-analysis/server-api";

const data: MarketDashboardData = {
  properties: { count: 0, properties: [] },
  summary: {
    total_count: 50,
    matched_count: 0,
    price: { mean: null, median: null, minimum: null, maximum: null },
  },
  priceDistribution: { dimension: "price", matched_count: 0, buckets: [] },
  featureDistribution: {
    dimension: "square_footage",
    matched_count: 0,
    buckets: [],
  },
};

beforeEach(() => {
  vi.mocked(getMarketDashboard).mockResolvedValue(data);
});

test("loads server aggregates using filters and chart dimension from the URL", async () => {
  render(
    await MarketAnalysisPage({
      searchParams: Promise.resolve({
        min_price: "200000",
        chart_dimension: "bedrooms",
      }),
    }),
  );

  expect(getMarketDashboard).toHaveBeenCalledWith(
    { min_price: 200000 },
    "bedrooms",
  );
  expect(
    screen.getByRole("heading", {
      level: 1,
      name: "Property Market Analysis",
    }),
  ).toBeInTheDocument();
  expect(screen.getByText(/0 matching properties/i)).toBeInTheDocument();
});

test("shows invalid deep links without requesting the Java service", async () => {
  vi.mocked(getMarketDashboard).mockClear();

  render(
    await MarketAnalysisPage({
      searchParams: Promise.resolve({ min_price: ["200000", "300000"] }),
    }),
  );

  expect(screen.getByRole("alert")).toHaveTextContent(/invalid market filter/i);
  expect(screen.getByRole("link", { name: /reset filters/i })).toHaveAttribute(
    "href",
    "/market-analysis",
  );
  expect(getMarketDashboard).not.toHaveBeenCalled();
});

test("exports the market analysis page title metadata", () => {
  expect(metadata.title).toBe("Market Analysis");
});
