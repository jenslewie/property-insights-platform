import { estimateResultSchema } from "@/lib/property-schema";
import { validationIssueListSchema } from "@/lib/api-error-schema";

const defaultEstimatorUrl = "http://localhost:9001";

function invalidUpstreamResponse() {
  return Response.json(
    {
      error: "Property estimator service returned an invalid response.",
    },
    { status: 502 },
  );
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

  const baseUrl = (
    process.env.PROPERTY_ESTIMATOR_API_URL ?? defaultEstimatorUrl
  ).replace(/\/$/, "");

  let upstream: Response;

  try {
    upstream = await fetch(`${baseUrl}/api/v1/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { error: "Property estimator service is unavailable." },
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
    const detail =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? payload.detail
        : undefined;
    const error =
      typeof detail === "string"
        ? detail
        : upstream.status === 422
          ? "Request validation failed."
          : "Property estimator service rejected the request.";
    const fieldErrors = validationIssueListSchema.safeParse(detail);

    return Response.json(
      fieldErrors.success
        ? { error, fieldErrors: fieldErrors.data }
        : { error },
      { status: upstream.status },
    );
  }

  const parsed = estimateResultSchema.safeParse(payload);

  return parsed.success
    ? Response.json(parsed.data)
    : invalidUpstreamResponse();
}
