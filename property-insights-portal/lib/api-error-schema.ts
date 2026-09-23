import { z } from "zod";

export const validationIssueSchema = z.looseObject({
  loc: z.array(z.union([z.string(), z.number()])),
  msg: z.string(),
  type: z.string(),
});

export const validationIssueListSchema = z.array(validationIssueSchema);

export const estimateErrorSchema = z
  .object({
    error: z.string(),
    fieldErrors: validationIssueListSchema.optional(),
  })
  .strict();

export type ValidationIssue = z.infer<typeof validationIssueSchema>;
