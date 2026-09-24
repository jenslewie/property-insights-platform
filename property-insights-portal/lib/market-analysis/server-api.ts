import { z } from "zod";
import { filterSearchParams, matchesSegment } from "./filters";
import type { FeatureDimension, SegmentFilters } from "./fields";
import {
  distributionSchema,
  marketSummarySchema,
  propertyListSchema,
  type DistributionResponse,
  type MarketSummary,
  type PropertyList,
} from "./schemas";

export type MarketDashboardData = {
  properties: PropertyList;
  summary: MarketSummary;
  priceDistribution: DistributionResponse;
  featureDistribution: DistributionResponse;
};

export async function getMarketDashboard(
  filters: SegmentFilters,
  dimension: FeatureDimension,
): Promise<MarketDashboardData> {
  const baseUrl = (
    process.env.MARKET_ANALYSIS_API_URL ?? "http://localhost:9002"
  ).replace(/\/$/, "");
  const query = filterSearchParams(filters).toString();
  const suffix = query ? `?${query}` : "";

  const [properties, summary, priceDistribution, featureDistribution] =
    await Promise.all([
      readJson(`${baseUrl}/api/v1/properties`, propertyListSchema),
      readJson(
        `${baseUrl}/api/v1/properties/statistics/summary${suffix}`,
        marketSummarySchema,
      ),
      readJson(
        `${baseUrl}/api/v1/properties/statistics/distributions/price${suffix}`,
        distributionSchema,
      ),
      readJson(
        `${baseUrl}/api/v1/properties/statistics/distributions/${dimension}${suffix}`,
        distributionSchema,
      ),
    ]);

  const dashboard = {
    properties,
    summary,
    priceDistribution,
    featureDistribution,
  };
  const locallyMatchedCount = properties.properties.filter((property) =>
    matchesSegment(property, filters),
  ).length;
  if (
    properties.count !== summary.total_count ||
    locallyMatchedCount !== summary.matched_count ||
    priceDistribution.matched_count !== summary.matched_count ||
    featureDistribution.matched_count !== summary.matched_count ||
    priceDistribution.dimension !== "price" ||
    featureDistribution.dimension !== dimension
  ) {
    throw new Error("Market analysis returned an invalid response.");
  }

  return dashboard;
}

async function readJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new Error("Market analysis service is unavailable.");
  }
  if (!response.ok) {
    throw new Error("Market analysis request failed.");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("Market analysis returned an invalid response.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new Error("Market analysis returned an invalid response.");
  }
  return parsed.data;
}
