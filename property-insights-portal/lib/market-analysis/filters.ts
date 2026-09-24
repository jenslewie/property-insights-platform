import type { PropertyRecord } from "./schemas";
import {
  featureDimensions,
  marketFields,
  type FeatureDimension,
  type MarketField,
  type SegmentFilters,
} from "./fields";

export type MarketQueryResult =
  | {
      ok: true;
      filters: SegmentFilters;
      scenario: MarketScenario | undefined;
      dimension: FeatureDimension;
    }
  | { ok: false; error: string };

export type MarketScenario = {
  schoolRatingDelta?: number;
  squareFootagePercent?: number;
  bedroomsDelta?: number;
  bathroomsDelta?: number;
  yearBuiltDelta?: number;
  lotSizeDelta?: number;
  distanceToCityCenterDelta?: number;
};

const scenarioParameters = [
  ["scenario_school_rating_delta", "schoolRatingDelta"],
  ["scenario_square_footage_percent", "squareFootagePercent"],
  ["scenario_bedrooms_delta", "bedroomsDelta"],
  ["scenario_bathrooms_delta", "bathroomsDelta"],
  ["scenario_year_built_delta", "yearBuiltDelta"],
  ["scenario_lot_size_delta", "lotSizeDelta"],
  ["scenario_distance_to_city_center_delta", "distanceToCityCenterDelta"],
] as const satisfies ReadonlyArray<readonly [string, keyof MarketScenario]>;

const integerScenarioFields = new Set<keyof MarketScenario>([
  "bedroomsDelta",
  "yearBuiltDelta",
  "lotSizeDelta",
]);

const integerFields = new Set<MarketField>([
  "square_footage",
  "bedrooms",
  "year_built",
  "lot_size",
]);
const decimalPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export function parseMarketQuery(
  query: Record<string, string | string[] | undefined>,
): MarketQueryResult {
  const filters: SegmentFilters = {};
  const scenario: MarketScenario = {};
  let scenarioWasSpecified = false;
  let dimension: FeatureDimension = "square_footage";

  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined) continue;
    if (Array.isArray(raw) || raw.trim() === "") {
      return { ok: false, error: "Invalid market filter parameter." };
    }

    if (key === "chart_dimension") {
      if (!featureDimensions.includes(raw as FeatureDimension)) {
        return { ok: false, error: "Unsupported feature distribution." };
      }
      dimension = raw as FeatureDimension;
      continue;
    }

    const scenarioParameter = scenarioParameters.find(
      ([parameter]) => parameter === key,
    );
    if (scenarioParameter) {
      const scenarioField = scenarioParameter[1];
      scenarioWasSpecified = true;
      if (!decimalPattern.test(raw.trim())) {
        return { ok: false, error: "Invalid market scenario parameter." };
      }
      const value = Number(raw.trim());
      if (
        !Number.isFinite(value) ||
        (integerScenarioFields.has(scenarioField) && !Number.isInteger(value))
      ) {
        return { ok: false, error: "Invalid market scenario parameter." };
      }
      if (value !== 0) {
        scenario[scenarioField] = value;
      }
      continue;
    }

    const match = /^(min|max)_(.+)$/.exec(key);
    const field = match?.[2] as MarketField | undefined;
    if (!match || !field || !marketFields.includes(field)) {
      return { ok: false, error: "Invalid market filter parameter." };
    }
    if (!decimalPattern.test(raw.trim())) {
      return { ok: false, error: "Invalid market filter parameter." };
    }

    const value = Number(raw.trim());
    if (
      !Number.isFinite(value) ||
      (integerFields.has(field) && !Number.isInteger(value))
    ) {
      return { ok: false, error: "Invalid market filter parameter." };
    }
    filters[key as keyof SegmentFilters] = value;
  }

  if (scenarioWasSpecified && Object.keys(scenario).length === 0) {
    return {
      ok: false,
      error: "A scenario must make an effective adjustment.",
    };
  }

  for (const field of marketFields) {
    const minimum = filters[`min_${field}`];
    const maximum = filters[`max_${field}`];
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
      return {
        ok: false,
        error: "Minimum filter value must not exceed maximum.",
      };
    }
  }

  return {
    ok: true,
    filters,
    scenario: Object.keys(scenario).length === 0 ? undefined : scenario,
    dimension,
  };
}

export function filterSearchParams(filters: SegmentFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const field of marketFields) {
    for (const prefix of ["min", "max"] as const) {
      const key = `${prefix}_${field}` as keyof SegmentFilters;
      const value = filters[key];
      if (value !== undefined) params.set(key, String(value));
    }
  }
  return params;
}

export function dashboardSearchParams(
  filters: SegmentFilters,
  dimension: FeatureDimension,
  scenario?: MarketScenario,
): URLSearchParams {
  const params = conditionSearchParams(filters, scenario);
  params.set("chart_dimension", dimension);
  return params;
}

export function conditionSearchParams(
  filters: SegmentFilters,
  scenario?: MarketScenario,
): URLSearchParams {
  const params = filterSearchParams(filters);
  for (const [parameter, field] of scenarioParameters) {
    const value = scenario?.[field];
    if (value !== undefined) params.set(parameter, String(value));
  }
  return params;
}

export function matchesSegment(
  property: PropertyRecord,
  filters: SegmentFilters,
): boolean {
  return marketFields.every((field) => {
    const value = property[field];
    const minimum = filters[`min_${field}`];
    const maximum = filters[`max_${field}`];
    return (
      (minimum === undefined || value >= minimum) &&
      (maximum === undefined || value <= maximum)
    );
  });
}
