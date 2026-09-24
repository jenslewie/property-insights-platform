import { describe, expect, test } from "vitest";
import {
  distributionSchema,
  marketSummarySchema,
  priceImpactResponseSchema,
  propertyListSchema,
} from "./schemas";

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
const baseline = {
  square_footage: property.square_footage,
  bedrooms: property.bedrooms,
  bathrooms: property.bathrooms,
  year_built: property.year_built,
  lot_size: property.lot_size,
  distance_to_city_center: property.distance_to_city_center,
  school_rating: property.school_rating,
};

describe("market API schemas", () => {
  test("rejects a property list with an inconsistent count", () => {
    expect(
      propertyListSchema.safeParse({ count: 2, properties: [property] })
        .success,
    ).toBe(false);
  });

  test("rejects a summary with more matches than total records", () => {
    expect(
      marketSummarySchema.safeParse({
        total_count: 1,
        matched_count: 2,
        price: { mean: 1, median: 1, minimum: 1, maximum: 1 },
      }).success,
    ).toBe(false);
  });

  test("accepts null price statistics for an empty segment", () => {
    expect(
      marketSummarySchema.safeParse({
        total_count: 50,
        matched_count: 0,
        price: { mean: null, median: null, minimum: null, maximum: null },
      }).success,
    ).toBe(true);
  });

  test("rejects partially populated price statistics for an empty segment", () => {
    expect(
      marketSummarySchema.safeParse({
        total_count: 50,
        matched_count: 0,
        price: { mean: 250000, median: null, minimum: null, maximum: null },
      }).success,
    ).toBe(false);
  });

  test("rejects distribution buckets whose counts do not sum to matches", () => {
    expect(
      distributionSchema.safeParse({
        dimension: "price",
        matched_count: 1,
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
        ],
      }).success,
    ).toBe(false);
  });

  test("accepts zero-count buckets with null average price", () => {
    expect(
      distributionSchema.safeParse({
        dimension: "price",
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
        ],
      }).success,
    ).toBe(true);
  });

  test.each([
    { count: 0, average_price: 200000 },
    { count: 1, average_price: null },
  ])("rejects an average price inconsistent with bucket count", (bucket) => {
    expect(
      distributionSchema.safeParse({
        dimension: "price",
        matched_count: bucket.count,
        buckets: [
          {
            key: "sample",
            label: "Sample",
            min_inclusive: null,
            max_exclusive: null,
            exact_value: null,
            ...bucket,
          },
        ],
      }).success,
    ).toBe(false);
  });

  test("rejects a price impact response with a string prediction", () => {
    expect(
      priceImpactResponseSchema.safeParse({
        baseline,
        changes: { square_footage: { from: 1550, to: 1800 } },
        baseline_predicted_price: "420000",
        scenario_predicted_price: 465000,
        absolute_change: 45000,
        percentage_change: 10.71,
      }).success,
    ).toBe(false);
  });

  test("accepts a null percentage change", () => {
    expect(
      priceImpactResponseSchema.safeParse({
        baseline,
        changes: { square_footage: { from: 1550, to: 1800 } },
        baseline_predicted_price: 0,
        scenario_predicted_price: 45000,
        absolute_change: 45000,
        percentage_change: null,
      }).success,
    ).toBe(true);
  });
});
