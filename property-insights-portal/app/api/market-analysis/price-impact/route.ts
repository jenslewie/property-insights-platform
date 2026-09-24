import { z } from "zod";
import { priceImpactResponseSchema } from "@/lib/market-analysis/schemas";
import { propertySchema } from "@/lib/property-schema";

const defaultMarketAnalysisUrl = "http://localhost:9002";
const maximumProblemDetailLength = 500;

const requestSchema = z
  .object({
    baseline: propertySchema.strict(),
    changes: propertySchema.partial().strict(),
  })
  .strict()
  .refine(({ baseline, changes }) =>
    Object.entries(changes).some(
      ([field, value]) => baseline[field as keyof typeof baseline] !== value,
    ),
  );

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
    upstream = await fetch(`${baseUrl}/api/v1/properties/price-impact`, {
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
