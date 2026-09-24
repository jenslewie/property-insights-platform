import type { PropertyRecord } from "./schemas";
import {
  featureDimensions,
  marketFields,
  type FeatureDimension,
  type MarketField,
  type SegmentFilters,
} from "./fields";

export type MarketQueryResult =
  | { ok: true; filters: SegmentFilters; dimension: FeatureDimension }
  | { ok: false; error: string };

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

  return { ok: true, filters, dimension };
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
): URLSearchParams {
  const params = filterSearchParams(filters);
  params.set("chart_dimension", dimension);
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
