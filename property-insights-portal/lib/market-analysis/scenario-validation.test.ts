import { expect, test } from "vitest";
import { validateScenario } from "./scenario-validation";
import type { PropertyRecord } from "./schemas";

function property(lotSize: number): PropertyRecord {
  return {
    id: 1,
    square_footage: 1500,
    bedrooms: 3,
    bathrooms: 2,
    year_built: 1997,
    lot_size: lotSize,
    distance_to_city_center: 4.1,
    school_rating: 7,
    price: 200000,
  };
}

test.each([
  [96000, 5],
  [6800, -100],
  [1, -51],
  [500, -99.90001],
  [100000, 0.0005],
  [6800, 1e20],
])("rejects lot size %s adjusted by %s percent", (lotSize, percent) => {
  expect(
    validateScenario({ lotSizePercent: percent }, [property(lotSize)]),
  ).toMatchObject({ lotSizePercent: { invalidCount: 1 } });
});

test.each([
  [6800, -2.5],
  [500, -99.9],
  [1, -50],
  [100000, -0.0005],
  [100000, 1e-7],
])("accepts lot size %s adjusted by %s percent", (lotSize, percent) => {
  expect(
    validateScenario({ lotSizePercent: percent }, [property(lotSize)]),
  ).toEqual({});
});

test("uses decimal HALF_UP rounding for square footage percentages too", () => {
  expect(
    validateScenario({ squareFootagePercent: -99.9 }, [
      { ...property(6800), square_footage: 500 },
    ]),
  ).toEqual({});
});
