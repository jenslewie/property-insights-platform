"use client";

import { useEffect, useRef, useState } from "react";
import {
  conditionSearchParams,
  type MarketScenario,
} from "@/lib/market-analysis/filters";
import type {
  FeatureDimension,
  SegmentFilters,
} from "@/lib/market-analysis/fields";
import {
  priceImpactResponseSchema,
  type PriceImpactResponse,
} from "@/lib/market-analysis/schemas";
import type { ScenarioValidationErrors } from "@/lib/market-analysis/scenario-validation";
import { formatNumericValue } from "@/lib/number-format";

type Props = {
  filters: SegmentFilters;
  scenario: MarketScenario | undefined;
  dimension: FeatureDimension;
  propertyCount: number;
  validationErrors?: ScenarioValidationErrors;
  onEditScenario?: () => void;
};

function signed(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatNumericValue(Math.abs(value))}`;
}

function percentage(value: number | null): string {
  return value === null ? "Unavailable" : `${signed(value)}%`;
}

function responseError(payload: unknown): string {
  if (typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === "string") return record.error.slice(0, 500);
    if (typeof record.detail === "string") return record.detail.slice(0, 500);
  }
  return "The price impact request failed.";
}

function requestBody(
  filters: SegmentFilters,
  scenario: MarketScenario,
): string {
  const adjustments = {
    ...(scenario.schoolRatingDelta === undefined
      ? {}
      : { school_rating_delta: scenario.schoolRatingDelta }),
    ...(scenario.squareFootagePercent === undefined
      ? {}
      : { square_footage_percent: scenario.squareFootagePercent }),
    ...(scenario.bedroomsDelta === undefined
      ? {}
      : { bedrooms_delta: scenario.bedroomsDelta }),
    ...(scenario.bathroomsDelta === undefined
      ? {}
      : { bathrooms_delta: scenario.bathroomsDelta }),
    ...(scenario.yearBuiltDelta === undefined
      ? {}
      : { year_built_delta: scenario.yearBuiltDelta }),
    ...(scenario.lotSizeDelta === undefined
      ? {}
      : { lot_size_delta: scenario.lotSizeDelta }),
    ...(scenario.distanceToCityCenterDelta === undefined
      ? {}
      : { distance_to_city_center_delta: scenario.distanceToCityCenterDelta }),
  };
  return JSON.stringify({ filters, scenario: { adjustments } });
}

function validationKey(errors?: ScenarioValidationErrors): string {
  return Object.values(errors ?? {})
    .flatMap((issue) => (issue ? [issue.message] : []))
    .join("|");
}

function ImpactResults({ result }: { result: PriceImpactResponse }) {
  const rows = [
    ["Mean", result.baseline.mean, result.scenario.mean, result.impact.mean],
    [
      "Median",
      result.baseline.median,
      result.scenario.median,
      result.impact.median,
    ],
    [
      "Minimum",
      result.baseline.minimum,
      result.scenario.minimum,
      result.impact.minimum,
    ],
    [
      "Maximum",
      result.baseline.maximum,
      result.scenario.maximum,
      result.impact.maximum,
    ],
  ] as const;

  return (
    <div className="mt-3 overflow-x-auto">
      <table
        aria-label="All predicted metrics"
        className="w-full min-w-[42rem] text-left text-sm"
      >
        <thead className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            <th className="p-2" scope="col">
              Metric
            </th>
            <th className="p-2" scope="col">
              Predicted baseline
            </th>
            <th className="p-2" scope="col">
              Predicted scenario
            </th>
            <th className="p-2" scope="col">
              Absolute change
            </th>
            <th className="p-2" scope="col">
              Percent change
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, baseline, scenario, impact]) => (
            <tr className="border-t border-blue-200" key={label}>
              <th className="p-2 font-medium" scope="row">
                {label}
              </th>
              <td className="p-2 tabular-nums">
                {formatNumericValue(baseline)}
              </td>
              <td className="p-2 tabular-nums">
                {formatNumericValue(scenario)}
              </td>
              <td className="p-2 tabular-nums">
                {signed(impact.absolute_change)}
              </td>
              <td className="p-2 tabular-nums">
                {percentage(impact.percentage_change)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PriceImpact(props: Props) {
  if (props.scenario === undefined) return null;
  const conditionKey = conditionSearchParams(
    props.filters,
    props.scenario,
  ).toString();
  return (
    <PriceImpactState
      key={`${conditionKey}|${validationKey(props.validationErrors)}`}
      {...props}
    />
  );
}

function PriceImpactState({
  filters,
  scenario,
  propertyCount,
  validationErrors = {},
  onEditScenario,
}: Props) {
  const latestRequest = useRef(0);
  const [pending, setPending] = useState(propertyCount > 0);
  const [retry, setRetry] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<PriceImpactResponse | null>(null);
  const [previousPropertyCount, setPreviousPropertyCount] =
    useState(propertyCount);
  const conditionKey = conditionSearchParams(filters, scenario).toString();
  const currentRequestBody =
    scenario === undefined ? null : requestBody(filters, scenario);
  const validationMessages = Object.values(validationErrors).flatMap((issue) =>
    issue ? [issue.message] : [],
  );
  const validationKey = validationMessages.join("|");

  if (previousPropertyCount !== propertyCount) {
    setPreviousPropertyCount(propertyCount);
    setPending(propertyCount > 0);
    setDetailsOpen(false);
    setRequestError(null);
    setResult(null);
  }

  useEffect(() => {
    const requestId = ++latestRequest.current;
    let active = true;

    if (validationKey !== "") {
      return () => {
        active = false;
      };
    }

    if (currentRequestBody === null || propertyCount === 0) {
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        const response = await fetch("/api/market-analysis/price-impact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: currentRequestBody,
          cache: "no-store",
        });
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          if (active && requestId === latestRequest.current) {
            setRequestError("The price impact response was invalid.");
          }
          return;
        }

        if (!active || requestId !== latestRequest.current) return;
        if (!response.ok) {
          setRequestError(responseError(payload));
          return;
        }
        const parsed = priceImpactResponseSchema.safeParse(payload);
        if (!parsed.success) {
          setRequestError("The price impact response was invalid.");
          return;
        }
        setResult(parsed.data);
      } catch {
        if (active && requestId === latestRequest.current) {
          setRequestError(
            "The market analysis service is unavailable. Please try again.",
          );
        }
      } finally {
        if (active && requestId === latestRequest.current) setPending(false);
      }
    })();

    return () => {
      active = false;
      if (latestRequest.current === requestId) latestRequest.current += 1;
    };
  }, [conditionKey, currentRequestBody, propertyCount, retry, validationKey]);

  return (
    <section
      aria-labelledby="price-impact-heading"
      className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl font-semibold" id="price-impact-heading">
          What-if impact
        </h2>
        {onEditScenario ? (
          <button
            className="rounded-lg border border-violet-300 px-3 py-1.5 font-semibold text-violet-950 hover:bg-violet-100"
            onClick={onEditScenario}
            type="button"
          >
            Edit scenario
          </button>
        ) : null}
      </div>
      {propertyCount === 0 ? (
        <p className="text-sm text-slate-700" role="status">
          No properties match this segment, so no predicted impact is available.
        </p>
      ) : null}
      {propertyCount > 0 && validationMessages.length > 0 ? (
        <div
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-900"
          role="alert"
        >
          <p>Correct these scenario adjustments before calculating impact.</p>
          <ul className="mt-1 list-inside list-disc">
            {validationMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {propertyCount > 0 && validationMessages.length === 0 && pending ? (
        <p className="text-sm text-slate-600" role="status">
          Calculating market predictions…
        </p>
      ) : null}
      {propertyCount > 0 && validationMessages.length === 0 && requestError ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-red-900"
          role="alert"
        >
          <p>{requestError}</p>
          <button
            className="rounded-lg border border-red-400 px-3 py-1 font-semibold hover:bg-red-100"
            onClick={() => {
              setRequestError(null);
              setPending(true);
              setRetry((current) => current + 1);
            }}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}
      {propertyCount > 0 && validationMessages.length === 0 && result ? (
        <>
          <div className="rounded-xl border border-violet-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-700">
              Average predicted market price
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xl font-semibold tabular-nums text-slate-950">
              <span>
                Predicted baseline: {formatNumericValue(result.baseline.mean)}
              </span>
              <span aria-hidden="true">→</span>
              <span>
                Predicted scenario: {formatNumericValue(result.scenario.mean)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
              <p>
                Absolute change: {signed(result.impact.mean.absolute_change)}
              </p>
              <p>
                Percent change:{" "}
                {percentage(result.impact.mean.percentage_change)}
              </p>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Predictions cover {result.property_count} properties. Historical
              dashboard statistics remain based on source prices.
            </p>
          </div>
          <button
            aria-controls="all-predicted-metrics"
            aria-expanded={detailsOpen}
            className="rounded-lg border border-violet-300 px-3 py-2 text-sm font-semibold text-violet-950 hover:bg-violet-100"
            onClick={() => setDetailsOpen((current) => !current)}
            type="button"
          >
            {detailsOpen
              ? "Hide predicted metrics"
              : "View all predicted metrics"}
          </button>
          {detailsOpen ? (
            <div id="all-predicted-metrics">
              <ImpactResults result={result} />
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
