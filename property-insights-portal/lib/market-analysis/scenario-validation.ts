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

const featureRules: Readonly<Record<ScenarioField, FeatureRule>> = {
  schoolRatingDelta: {
    label: "school rating",
    propertyField: "school_rating",
    adjust: (property, adjustment) => property.school_rating + adjustment,
  },
  squareFootagePercent: {
    label: "square footage",
    propertyField: "square_footage",
    adjust: (property, adjustment) => {
      const transformed = (property.square_footage * (100 + adjustment)) / 100;
      return Math.sign(transformed) * Math.floor(Math.abs(transformed) + 0.5);
    },
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
  lotSizeDelta: {
    label: "lot size",
    propertyField: "lot_size",
    adjust: (property, adjustment) => property.lot_size + adjustment,
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
