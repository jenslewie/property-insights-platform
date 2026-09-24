import { describe, expect, test } from "vitest";
import {
  dashboardSearchParams,
  filterSearchParams,
  conditionSearchParams,
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
      scenario: undefined,
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
    ["zero-only scenario", { scenario_school_rating_delta: "0" }],
    [
      "fractional integer scenario adjustment",
      { scenario_bedrooms_delta: "0.5" },
    ],
    ["duplicate scenario value", { scenario_school_rating_delta: ["1", "2"] }],
    ["unknown scenario parameter", { scenario_id: "abc" }],
    [
      "nonfinite scenario adjustment",
      { scenario_school_rating_delta: "Infinity" },
    ],
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

  test("serializes applied conditions and chart dimension separately", () => {
    const filters = { min_bedrooms: 3 };
    const scenario = { schoolRatingDelta: 1, squareFootagePercent: 5 };

    expect(conditionSearchParams(filters, scenario).toString()).toBe(
      "min_bedrooms=3&scenario_school_rating_delta=1&scenario_square_footage_percent=5",
    );
    expect(
      dashboardSearchParams(filters, "bedrooms", scenario).toString(),
    ).toBe(
      "min_bedrooms=3&scenario_school_rating_delta=1&scenario_square_footage_percent=5&chart_dimension=bedrooms",
    );
  });

  test("parses scenario adjustments for all seven model features", () => {
    expect(
      parseMarketQuery({
        scenario_school_rating_delta: "1",
        scenario_square_footage_percent: "5",
        scenario_bedrooms_delta: "1",
        scenario_bathrooms_delta: "0.5",
        scenario_year_built_delta: "5",
        scenario_lot_size_delta: "500",
        scenario_distance_to_city_center_delta: "0.5",
      }),
    ).toEqual({
      ok: true,
      filters: {},
      scenario: {
        schoolRatingDelta: 1,
        squareFootagePercent: 5,
        bedroomsDelta: 1,
        bathroomsDelta: 0.5,
        yearBuiltDelta: 5,
        lotSizeDelta: 500,
        distanceToCityCenterDelta: 0.5,
      },
      dimension: "square_footage",
    });
  });

  test("serializes all seven scenario adjustments into the dashboard URL", () => {
    expect(
      conditionSearchParams(
        {},
        {
          schoolRatingDelta: 1,
          squareFootagePercent: 5,
          bedroomsDelta: 1,
          bathroomsDelta: 0.5,
          yearBuiltDelta: 5,
          lotSizeDelta: 500,
          distanceToCityCenterDelta: 0.5,
        },
      ).toString(),
    ).toBe(
      "scenario_school_rating_delta=1&scenario_square_footage_percent=5&scenario_bedrooms_delta=1&scenario_bathrooms_delta=0.5&scenario_year_built_delta=5&scenario_lot_size_delta=500&scenario_distance_to_city_center_delta=0.5",
    );
  });

  test("normalizes zero adjustments away when another adjustment is active", () => {
    expect(
      parseMarketQuery({
        scenario_school_rating_delta: "0.0",
        scenario_square_footage_percent: "5.00",
      }),
    ).toEqual({
      ok: true,
      filters: {},
      scenario: { squareFootagePercent: 5 },
      dimension: "square_footage",
    });
  });

  test("matches both inclusive bounds", () => {
    expect(
      matchesSegment(property, { min_price: 200000, max_price: 200000 }),
    ).toBe(true);
    expect(matchesSegment(property, { min_price: 200001 })).toBe(false);
  });
});
