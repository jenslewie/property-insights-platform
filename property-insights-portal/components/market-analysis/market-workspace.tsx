"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  conditionSearchParams,
  dashboardSearchParams,
  filterSearchParams,
  matchesSegment,
  parseMarketQuery,
} from "@/lib/market-analysis/filters";
import type {
  FeatureDimension,
  SegmentFilters,
} from "@/lib/market-analysis/fields";
import type { MarketScenario } from "@/lib/market-analysis/filters";
import type { MarketDashboardData } from "@/lib/market-analysis/server-api";
import {
  distributionSchema,
  type DistributionResponse,
} from "@/lib/market-analysis/schemas";
import { validateScenario } from "@/lib/market-analysis/scenario-validation";
import { ExportControls } from "./export-controls";
import { MarketOverview } from "./market-overview";
import { PriceImpact } from "./price-impact";
import { PropertyTable } from "./property-table";
import { ScenarioDrawer } from "./scenario-drawer";
import { SegmentFiltersForm } from "./segment-filters";

type Props = {
  data: MarketDashboardData;
  filters: SegmentFilters;
  scenario: MarketScenario | undefined;
  dimension: FeatureDimension;
};

type FeatureSnapshot = {
  key: string;
  distribution?: DistributionResponse;
  error?: string;
};

function queryValues(searchParams: {
  keys: () => IterableIterator<string>;
  getAll: (name: string) => string[];
}): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  for (const key of new Set(searchParams.keys())) {
    const all = searchParams.getAll(key);
    values[key] = all.length === 1 ? all[0] : all;
  }
  return values;
}

function responseError(payload: unknown): string {
  if (typeof payload === "object" && payload !== null) {
    const error = (payload as Record<string, unknown>).error;
    if (typeof error === "string") return error.slice(0, 500);
  }
  return "The feature distribution could not be loaded.";
}

export function MarketWorkspace({ data, filters, scenario, dimension }: Props) {
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const parsedLocation =
    search && searchParams ? parseMarketQuery(queryValues(searchParams)) : null;
  const activeFilters = parsedLocation?.ok ? parsedLocation.filters : filters;
  const activeScenario = parsedLocation?.ok
    ? parsedLocation.scenario
    : scenario;
  const activeDimension = parsedLocation?.ok
    ? parsedLocation.dimension
    : dimension;
  const [scenarioDrawerKey, setScenarioDrawerKey] = useState<string | null>(
    null,
  );
  const [featureSnapshot, setFeatureSnapshot] =
    useState<FeatureSnapshot | null>(null);
  const [featureRetry, setFeatureRetry] = useState(0);
  const latestFeatureRequest = useRef(0);
  const activeFiltersKey = filterSearchParams(activeFilters).toString();
  const serverFiltersKey = filterSearchParams(filters).toString();
  const featureRequestKey = activeFiltersKey + "|" + activeDimension;
  const segmentMatchesServerData = activeFiltersKey === serverFiltersKey;
  const segmentProperties = segmentMatchesServerData
    ? data.properties.properties.filter((property) =>
        matchesSegment(property, activeFilters),
      )
    : [];
  const scenarioValidationErrors = validateScenario(
    activeScenario,
    segmentProperties,
  );
  const scenarioDrawerConditionKey = `${conditionSearchParams(activeFilters, activeScenario).toString()}|${activeDimension}`;
  if (
    scenarioDrawerKey !== null &&
    scenarioDrawerKey !== scenarioDrawerConditionKey
  ) {
    setScenarioDrawerKey(null);
  }
  const scenarioDrawerOpen = scenarioDrawerKey === scenarioDrawerConditionKey;
  const usingServerFeature =
    segmentMatchesServerData && activeDimension === dimension;
  const featureDistribution = usingServerFeature
    ? data.featureDistribution
    : segmentMatchesServerData && featureSnapshot?.key === featureRequestKey
      ? (featureSnapshot.distribution ?? null)
      : null;
  const featureError =
    featureSnapshot?.key === featureRequestKey
      ? featureSnapshot.error
      : undefined;
  const featurePending =
    !featureError &&
    (!segmentMatchesServerData ||
      (!usingServerFeature && featureSnapshot?.key !== featureRequestKey));

  useEffect(() => {
    if (!segmentMatchesServerData || activeDimension === dimension) return;

    const requestId = ++latestFeatureRequest.current;
    const controller = new AbortController();
    const params = new URLSearchParams(activeFiltersKey);
    params.set("dimension", activeDimension);

    void (async () => {
      try {
        const response = await fetch(
          "/api/market-analysis/distribution?" + params.toString(),
          { cache: "no-store", signal: controller.signal },
        );
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new Error("The feature distribution response was invalid.");
        }
        if (!response.ok) throw new Error(responseError(payload));
        const parsed = distributionSchema.safeParse(payload);
        if (!parsed.success || parsed.data.dimension !== activeDimension) {
          throw new Error("The feature distribution response was invalid.");
        }
        if (
          controller.signal.aborted ||
          requestId !== latestFeatureRequest.current
        ) {
          return;
        }
        setFeatureSnapshot({
          key: featureRequestKey,
          distribution: parsed.data,
        });
      } catch (error) {
        if (
          controller.signal.aborted ||
          requestId !== latestFeatureRequest.current
        ) {
          return;
        }
        setFeatureSnapshot({
          key: featureRequestKey,
          error:
            error instanceof Error &&
            error.message.startsWith("The feature distribution")
              ? error.message
              : "The feature distribution service is unavailable. Please retry.",
        });
      }
    })();

    return () => {
      controller.abort();
      if (latestFeatureRequest.current === requestId) {
        latestFeatureRequest.current += 1;
      }
    };
  }, [
    activeDimension,
    activeFiltersKey,
    dimension,
    featureRequestKey,
    featureRetry,
    segmentMatchesServerData,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentFiltersForm
          filters={activeFilters}
          scenario={activeScenario}
          dimension={activeDimension}
        />
        <ScenarioDrawer
          filters={activeFilters}
          scenario={activeScenario}
          dimension={activeDimension}
          propertyCount={data.summary.matched_count}
          properties={segmentProperties}
          segmentReady={segmentMatchesServerData}
          open={scenarioDrawerOpen}
          onOpenChange={(nextOpen) =>
            setScenarioDrawerKey(nextOpen ? scenarioDrawerConditionKey : null)
          }
        />
        <ExportControls
          filters={activeFilters}
          scenario={activeScenario}
          matchedCount={data.summary.matched_count}
          segmentReady={segmentMatchesServerData}
        />
        <p aria-live="polite" className="text-sm font-medium text-slate-700">
          {segmentMatchesServerData
            ? `${data.summary.matched_count} / ${data.summary.total_count} properties match this segment.`
            : "Updating dashboard for the selected filters…"}
        </p>
      </div>
      {segmentMatchesServerData ? (
        <>
          <MarketOverview
            summary={data.summary}
            priceDistribution={data.priceDistribution}
            featureDistribution={featureDistribution}
            dimension={activeDimension}
            featurePending={featurePending}
            featureError={featureError}
            onRetryFeature={() => {
              setFeatureSnapshot((current) =>
                current?.key === featureRequestKey ? null : current,
              );
              setFeatureRetry((current) => current + 1);
            }}
            onDimensionChange={(nextDimension) => {
              const query = dashboardSearchParams(
                activeFilters,
                nextDimension,
                activeScenario,
              ).toString();
              window.history.pushState(null, "", "/market-analysis?" + query);
            }}
          >
            {activeScenario !== undefined ? (
              <PriceImpact
                dimension={activeDimension}
                filters={activeFilters}
                propertyCount={data.summary.matched_count}
                scenario={activeScenario}
                validationErrors={scenarioValidationErrors}
                onEditScenario={() =>
                  setScenarioDrawerKey(scenarioDrawerConditionKey)
                }
              />
            ) : null}
          </MarketOverview>
          <PropertyTable
            filters={activeFilters}
            properties={data.properties.properties}
          />
        </>
      ) : (
        <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
          Market summary and property records will appear after this segment
          loads.
        </p>
      )}
    </div>
  );
}
