import { describe, expect, test } from "vitest";
import { propertySchema } from "./property-schema";

const validProperty = {
  square_footage: 1550,
  bedrooms: 3,
  bathrooms: 2,
  year_built: 1997,
  lot_size: 6800,
  distance_to_city_center: 4.1,
  school_rating: 7.6,
};

describe("propertySchema", () => {
  test("accepts a valid property", () => {
    expect(propertySchema.safeParse(validProperty).success).toBe(true);
  });

  test.each([
    ["zero square footage", { square_footage: 0 }],
    ["fractional bedrooms", { bedrooms: 2.5 }],
    ["zero bathrooms", { bathrooms: 0 }],
    ["year before 1900", { year_built: 1899 }],
    [
      "year beyond the rolling maximum",
      { year_built: new Date().getFullYear() + 6 },
    ],
    ["lot over 100000", { lot_size: 100001 }],
    ["negative distance", { distance_to_city_center: -1 }],
    ["school rating over 20", { school_rating: 20.1 }],
    ["non-finite number", { bathrooms: Number.POSITIVE_INFINITY }],
    ["missing value", { square_footage: undefined }],
  ])("rejects %s", (_name, override) => {
    expect(
      propertySchema.safeParse({ ...validProperty, ...override }).success,
    ).toBe(false);
  });
});
