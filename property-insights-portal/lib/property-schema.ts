import { z } from "zod";

const maximumBuildYear = new Date().getUTCFullYear() + 5;

export const propertySchema = z.object({
  square_footage: z.number().int().gt(0).max(10_000),
  bedrooms: z.number().int().min(1).max(10),
  bathrooms: z.number().gt(0).max(10),
  year_built: z.number().int().min(1900).max(maximumBuildYear),
  lot_size: z.number().int().gt(0).max(100_000),
  distance_to_city_center: z.number().min(0).max(100),
  school_rating: z.number().min(0).max(20),
});

export const estimateResponseSchema = z
  .object({
    property: propertySchema,
    predicted_price: z.number(),
  })
  .strict();

export const batchEstimateResponseSchema = z
  .object({
    count: z.number().int().min(1),
    estimates: z.array(estimateResponseSchema).min(1),
  })
  .strict()
  .refine(({ count, estimates }) => count === estimates.length, {
    message: "Estimate count must match the number of estimates.",
    path: ["count"],
  });

export const estimateResultSchema = z.union([
  estimateResponseSchema,
  batchEstimateResponseSchema,
]);

export const legacyEstimateRecordSchema = estimateResponseSchema.extend({
  id: z.string().min(1),
  created_at: z.iso.datetime(),
});

export const legacyEstimateHistorySchema = z.array(legacyEstimateRecordSchema);

export const estimateRecordSchema = legacyEstimateRecordSchema.extend({
  display_number: z.number().int().positive(),
});

export const estimateHistoryStateSchema = z
  .object({
    next_number: z.number().int().positive(),
    records: z.array(estimateRecordSchema),
  })
  .strict()
  .refine(
    ({ next_number, records }) =>
      records.every((record) => record.display_number < next_number),
    {
      message: "Next estimate number must exceed every saved estimate number.",
    },
  );
