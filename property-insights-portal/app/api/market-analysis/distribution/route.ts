import {
  featureDimensions,
  marketFields,
  type FeatureDimension,
  type SegmentFilters,
} from "@/lib/market-analysis/fields";
import { parseMarketQuery } from "@/lib/market-analysis/filters";
import { getMarketDistribution } from "@/lib/market-analysis/server-api";

const filterKeys = new Set(
  marketFields.flatMap((field) => ["min_" + field, "max_" + field]),
);

function readConditions(
  url: URL,
): { dimension: FeatureDimension; filters: SegmentFilters } | null {
  const values: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    if (all.length !== 1) return null;
    if (key !== "dimension" && !filterKeys.has(key)) return null;
    values[key] = all[0];
  }

  const dimensions = url.searchParams.getAll("dimension");
  if (
    dimensions.length !== 1 ||
    !featureDimensions.includes(dimensions[0] as FeatureDimension)
  ) {
    return null;
  }

  delete values.dimension;
  const parsed = parseMarketQuery(values);
  if (!parsed.ok) return null;

  return {
    dimension: dimensions[0] as FeatureDimension,
    filters: parsed.filters,
  };
}

export async function GET(request: Request) {
  const conditions = readConditions(new URL(request.url));
  if (!conditions) {
    return Response.json(
      { error: "Invalid distribution request." },
      { status: 400 },
    );
  }

  try {
    const distribution = await getMarketDistribution(
      conditions.filters,
      conditions.dimension,
    );
    return Response.json(distribution, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Market analysis request failed.";
    const status =
      message === "Market analysis service is unavailable." ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
