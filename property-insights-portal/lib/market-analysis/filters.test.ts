import { describe, expect, test } from "vitest";
import {
  dashboardSearchParams,
  filterSearchParams,
  matchesSegment,
  parseMarketQuery,
} from "./filters";

const property = {
  id: 1,
  square_footage: 1550,
  bedrooms: 3,
  bathrooms: 2,
  year_built: 1997,
  lot_size: 6800,
  distance_to_city_center: 4.1,
  school_rating: 7.6,
  price: 200000,
};

describe("market query parsing", () => {
  test("parses filters and chart dimension into typed values", () => {
    expect(
      parseMarketQuery({ min_price: "200000", chart_dimension: "bedrooms" }),
    ).toEqual({
      ok: true,
      filters: { min_price: 200000 },
      dimension: "bedrooms",
    });
  });

  test.each([
    ["duplicate values", { min_price: ["1", "2"] }],
    ["unknown query key", { sort: "price" }],
    ["empty bound", { min_price: "" }],
    ["nonfinite bound", { min_price: "NaN" }],
    ["fractional integer bound", { min_bedrooms: "2.5" }],
    ["inverted range", { min_price: "3", max_price: "2" }],
    ["price is not a feature dimension", { chart_dimension: "price" }],
  ])("rejects %s", (_name, query) => {
    expect(parseMarketQuery(query).ok).toBe(false);
  });

  test("serializes only market bounds to Java and preserves chart dimension in page URL", () => {
    const filters = { min_price: 200000, max_price: 300000 };

    expect(filterSearchParams(filters).toString()).toBe(
      "min_price=200000&max_price=300000",
    );
    expect(dashboardSearchParams(filters, "bedrooms").toString()).toBe(
      "min_price=200000&max_price=300000&chart_dimension=bedrooms",
    );
  });

  test("matches both inclusive bounds", () => {
    expect(
      matchesSegment(property, { min_price: 200000, max_price: 200000 }),
    ).toBe(true);
    expect(matchesSegment(property, { min_price: 200001 })).toBe(false);
  });
});
