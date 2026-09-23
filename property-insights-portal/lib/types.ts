import type { z } from "zod";
import type {
  estimateRecordSchema,
  estimateResponseSchema,
  estimateResultSchema,
  propertySchema,
} from "./property-schema";

export type PropertyFeatures = z.infer<typeof propertySchema>;
export type EstimateResponse = z.infer<typeof estimateResponseSchema>;
export type EstimateResult = z.infer<typeof estimateResultSchema>;
export type EstimateRecord = z.infer<typeof estimateRecordSchema>;
