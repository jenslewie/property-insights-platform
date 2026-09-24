import { z } from "zod";
import { propertySchema } from "../property-schema";
import { featureDimensions, marketFields } from "./fields";

const propertyRecordSchema = propertySchema
  .extend({
    id: z.number().int().positive(),
    price: z.number().finite().nonnegative(),
  })
  .strict();

export const propertyListSchema = z
  .object({
    count: z.number().int().nonnegative(),
    properties: z.array(propertyRecordSchema),
  })
  .strict()
  .refine(({ count, properties }) => count === properties.length, {
    message: "Property count must match the number of records.",
    path: ["count"],
  });

const nullablePriceStatsSchema = z.object({
  mean: z.number().finite().nullable(),
  median: z.number().finite().nullable(),
  minimum: z.number().finite().nullable(),
  maximum: z.number().finite().nullable(),
});

export const marketSummarySchema = z
  .object({
    total_count: z.number().int().nonnegative(),
    matched_count: z.number().int().nonnegative(),
    price: nullablePriceStatsSchema,
  })
  .strict()
  .superRefine(({ total_count, matched_count, price }, context) => {
    if (matched_count > total_count) {
      context.addIssue({
        code: "custom",
        message: "Matched count must not exceed total count.",
        path: ["matched_count"],
      });
    }
    const values = Object.values(price);
    const hasInvalidNulls =
      matched_count === 0
        ? values.some((value) => value !== null)
        : values.some((value) => value === null);
    if (hasInvalidNulls) {
      context.addIssue({
        code: "custom",
        message: "Price statistics must match the matched record count.",
        path: ["price"],
      });
    }
  });

const distributionBucketSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    min_inclusive: z.number().finite().nullable(),
    max_exclusive: z.number().finite().nullable(),
    exact_value: z.number().finite().nullable(),
    count: z.number().int().nonnegative(),
    average_price: z.number().finite().nullable(),
  })
  .strict()
  .superRefine(({ count, average_price }, context) => {
    if ((count === 0) !== (average_price === null)) {
      context.addIssue({
        code: "custom",
        message: "Average price must match the bucket record count.",
        path: ["average_price"],
      });
    }
  });

export const distributionSchema = z
  .object({
    dimension: z.enum(marketFields),
    matched_count: z.number().int().nonnegative(),
    buckets: z.array(distributionBucketSchema),
  })
  .strict()
  .refine(
    ({ matched_count, buckets }) =>
      buckets.reduce((sum, bucket) => sum + bucket.count, 0) === matched_count,
    { message: "Distribution bucket counts must match matched_count." },
  );

const featureChangeSchema = z
  .object({ from: z.number().finite(), to: z.number().finite() })
  .strict();

export const priceImpactResponseSchema = z
  .object({
    baseline: propertySchema.strict(),
    changes: z.partialRecord(z.enum(featureDimensions), featureChangeSchema),
    baseline_predicted_price: z.number().finite(),
    scenario_predicted_price: z.number().finite(),
    absolute_change: z.number().finite(),
    percentage_change: z.number().finite().nullable(),
  })
  .strict();

export type PropertyRecord = z.infer<typeof propertyRecordSchema>;
export type PropertyList = z.infer<typeof propertyListSchema>;
export type MarketSummary = z.infer<typeof marketSummarySchema>;
export type DistributionResponse = z.infer<typeof distributionSchema>;
export type PriceImpactResponse = z.infer<typeof priceImpactResponseSchema>;
