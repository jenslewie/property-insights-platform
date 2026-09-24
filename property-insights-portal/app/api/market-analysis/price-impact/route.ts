import { z } from "zod";
import { marketFields } from "@/lib/market-analysis/fields";
import { parseMarketQuery } from "@/lib/market-analysis/filters";
import { priceImpactResponseSchema } from "@/lib/market-analysis/schemas";

const defaultMarketAnalysisUrl = "http://localhost:9002";
const maximumProblemDetailLength = 500;
const integerFields = new Set([
  "square_footage",
  "bedrooms",
  "year_built",
  "lot_size",
]);
const filterNamePattern = new RegExp(`^(min|max)_(${marketFields.join("|")})$`);

const filtersSchema = z.record(z.string(), z.number().finite());
const adjustmentsSchema = z
  .object({
    school_rating_delta: z.number().finite().optional(),
    square_footage_percent: z.number().finite().optional(),
  })
  .strict()
  .refine((adjustments) =>
    Object.values(adjustments).some(
      (value) => value !== undefined && value !== 0,
    ),
  );
const requestSchema = z
  .object({
    filters: filtersSchema,
    scenario: z.object({ adjustments: adjustmentsSchema }).strict(),
  })
  .strict()
  .superRefine(({ filters }, context) => {
    for (const [key, value] of Object.entries(filters)) {
      if (!filterNamePattern.test(key)) {
        context.addIssue({
          code: "custom",
          message: "Unsupported market filter.",
        });
        return;
      }
      const field = key.replace(/^(min|max)_/, "");
      if (integerFields.has(field) && !Number.isInteger(value)) {
        context.addIssue({
          code: "custom",
          message: "Invalid market filter value.",
        });
        return;
      }
    }

    const parsedFilters = parseMarketQuery(
      Object.fromEntries(
        Object.entries(filters).map(([key, value]) => [key, String(value)]),
      ),
    );
    if (!parsedFilters.ok) {
      context.addIssue({ code: "custom", message: "Invalid market filters." });
    }
  });

function invalidUpstreamResponse() {
  return Response.json(
    { error: "Market analysis service returned an invalid response." },
    { status: 502 },
  );
}

function safeProblemDetail(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "detail" in payload &&
    typeof payload.detail === "string" &&
    payload.detail.trim().length > 0
  ) {
    return payload.detail.slice(0, maximumProblemDetailLength);
  }
  return "Market analysis service rejected the request.";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid price impact request." },
      { status: 422 },
    );
  }

  const baseUrl = (
    process.env.MARKET_ANALYSIS_API_URL ?? defaultMarketAnalysisUrl
  ).replace(/\/$/, "");

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/api/v1/market/price-impact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { error: "Market analysis service is unavailable." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return invalidUpstreamResponse();
  }

  if (!upstream.ok) {
    return Response.json(
      { error: safeProblemDetail(payload) },
      { status: upstream.status },
    );
  }

  const validated = priceImpactResponseSchema.safeParse(payload);
  return validated.success
    ? Response.json(validated.data)
    : invalidUpstreamResponse();
}
