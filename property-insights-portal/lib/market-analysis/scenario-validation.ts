import type { MarketScenario } from "./filters";
import type { PropertyRecord } from "./schemas";
import { propertySchema } from "../property-schema";

export type ScenarioField = keyof MarketScenario;

export type ScenarioValidationIssue = {
  invalidCount: number;
  message: string;
};

export type ScenarioValidationErrors = Partial<
  Record<ScenarioField, ScenarioValidationIssue>
>;

type FeatureRule = {
  label: string;
  propertyField: keyof typeof propertySchema.shape;
  adjust: (property: PropertyRecord, adjustment: number) => number;
};

function adjustedIntegerByPercent(baseline: number, percent: number): number {
  if (!Number.isFinite(percent)) return Number.NaN;

  // Use the decimal sent in JSON to match BigDecimal's HALF_UP rounding.
  const [significand, exponent = "0"] = percent.toString().split("e");
  const [whole, fraction = ""] = significand.split(".");
  const scale = fraction.length - Number(exponent);
  let coefficient = BigInt(whole + fraction);
  const denominator = scale > 0 ? BigInt(10) ** BigInt(scale) : BigInt(1);
  if (scale < 0) coefficient *= BigInt(10) ** BigInt(-scale);

  const divisor = BigInt(100) * denominator;
  const numerator = BigInt(baseline) * (divisor + coefficient);
  const magnitude = numerator < BigInt(0) ? -numerator : numerator;
  const rounded = (magnitude + divisor / BigInt(2)) / divisor;
  return Number(numerator < BigInt(0) ? -rounded : rounded);
}

const featureRules: Readonly<Record<ScenarioField, FeatureRule>> = {
  schoolRatingDelta: {
    label: "school rating",
    propertyField: "school_rating",
    adjust: (property, adjustment) => property.school_rating + adjustment,
  },
  squareFootagePercent: {
    label: "square footage",
    propertyField: "square_footage",
    adjust: (property, adjustment) =>
      adjustedIntegerByPercent(property.square_footage, adjustment),
  },
  bedroomsDelta: {
    label: "bedrooms",
    propertyField: "bedrooms",
    adjust: (property, adjustment) => property.bedrooms + adjustment,
  },
  bathroomsDelta: {
    label: "bathrooms",
    propertyField: "bathrooms",
    adjust: (property, adjustment) => property.bathrooms + adjustment,
  },
  yearBuiltDelta: {
    label: "year built",
    propertyField: "year_built",
    adjust: (property, adjustment) => property.year_built + adjustment,
  },
  lotSizePercent: {
    label: "lot size",
    propertyField: "lot_size",
    adjust: (property, adjustment) =>
      adjustedIntegerByPercent(property.lot_size, adjustment),
  },
  distanceToCityCenterDelta: {
    label: "distance to city center",
    propertyField: "distance_to_city_center",
    adjust: (property, adjustment) =>
      property.distance_to_city_center + adjustment,
  },
};

export function validateScenario(
  scenario: MarketScenario | undefined,
  properties: readonly PropertyRecord[],
): ScenarioValidationErrors {
  const errors: ScenarioValidationErrors = {};
  if (!scenario) return errors;

  for (const [field, rule] of Object.entries(featureRules) as [
    ScenarioField,
    FeatureRule,
  ][]) {
    const adjustment = scenario[field];
    if (adjustment === undefined || adjustment === 0) continue;

    const invalidCount = properties.filter((property) => {
      const value = rule.adjust(property, adjustment);
      return !propertySchema.shape[rule.propertyField].safeParse(value).success;
    }).length;

    if (invalidCount > 0) {
      const noun = invalidCount === 1 ? "property" : "properties";
      errors[field] = {
        invalidCount,
        message: `This adjustment would put ${invalidCount} ${noun} outside the allowed ${rule.label} range.`,
      };
    }
  }

  return errors;
}
