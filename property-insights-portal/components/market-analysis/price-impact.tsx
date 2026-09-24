"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  conditionSearchParams,
  dashboardSearchParams,
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
import { formatNumericValue } from "@/lib/number-format";

type Props = {
  filters: SegmentFilters;
  scenario: MarketScenario | undefined;
  dimension: FeatureDimension;
  propertyCount: number;
};

type Draft = {
  schoolRatingDelta: string;
  squareFootagePercent: string;
};

function draftFromScenario(scenario?: MarketScenario): Draft {
  return {
    schoolRatingDelta:
      scenario?.schoolRatingDelta === undefined
        ? ""
        : String(scenario.schoolRatingDelta),
    squareFootagePercent:
      scenario?.squareFootagePercent === undefined
        ? ""
        : String(scenario.squareFootagePercent),
  };
}

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
  };
  return JSON.stringify({ filters, scenario: { adjustments } });
}

function impactQuery(
  filters: SegmentFilters,
  scenario?: MarketScenario,
): string {
  return conditionSearchParams(filters, scenario).toString();
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
    <section
      aria-labelledby="price-impact-result-heading"
      className="rounded-xl border border-blue-200 bg-blue-50 p-4"
    >
      <h3 className="text-lg font-semibold" id="price-impact-result-heading">
        Model predicted market prices
      </h3>
      <p className="mt-1 text-sm text-slate-700">
        Predictions cover {result.property_count} properties. Historical
        dashboard statistics remain based on source prices.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[42rem] text-left text-sm">
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
    </section>
  );
}

export function PriceImpact(props: Props) {
  const key = impactQuery(props.filters, props.scenario);
  return <PriceImpactForm key={key} {...props} />;
}

function PriceImpactForm({
  filters,
  scenario,
  dimension,
  propertyCount,
}: Props) {
  const router = useRouter();
  const latestRequest = useRef(0);
  const [draft, setDraft] = useState(() => draftFromScenario(scenario));
  const [pending, setPending] = useState(false);
  const [isNavigating, startTransition] = useTransition();
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<PriceImpactResponse | null>(null);
  const analysisKey = impactQuery(filters, scenario);
  const currentRequestBody =
    scenario === undefined ? null : requestBody(filters, scenario);
  const hasEffectiveDraft =
    (draft.schoolRatingDelta.trim() !== "" &&
      Number.isFinite(Number(draft.schoolRatingDelta)) &&
      Number(draft.schoolRatingDelta) !== 0) ||
    (draft.squareFootagePercent.trim() !== "" &&
      Number.isFinite(Number(draft.squareFootagePercent)) &&
      Number(draft.squareFootagePercent) !== 0);

  useEffect(() => {
    const requestId = ++latestRequest.current;
    let active = true;
    if (currentRequestBody === null || propertyCount === 0) {
      return () => {
        active = false;
      };
    }

    void (async () => {
      await Promise.resolve();
      if (!active || requestId !== latestRequest.current) return;
      setPending(true);
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
  }, [analysisKey, currentRequestBody, propertyCount]);

  function applyScenario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (propertyCount === 0) return;
    const schoolRatingDelta = Number(draft.schoolRatingDelta);
    const squareFootagePercent = Number(draft.squareFootagePercent);
    const nextScenario: MarketScenario = {
      ...(draft.schoolRatingDelta.trim() === "" ||
      !Number.isFinite(schoolRatingDelta) ||
      schoolRatingDelta === 0
        ? {}
        : { schoolRatingDelta }),
      ...(draft.squareFootagePercent.trim() === "" ||
      !Number.isFinite(squareFootagePercent) ||
      squareFootagePercent === 0
        ? {}
        : { squareFootagePercent }),
    };
    if (Object.keys(nextScenario).length === 0 && scenario === undefined) {
      setRequestError("Enter at least one non-zero scenario adjustment.");
      return;
    }

    setRequestError(null);
    const query = dashboardSearchParams(
      filters,
      dimension,
      Object.keys(nextScenario).length === 0 ? undefined : nextScenario,
    ).toString();
    startTransition(() => router.push(`/market-analysis?${query}`));
  }

  return (
    <section
      aria-labelledby="price-impact-heading"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div>
        <h2 className="text-2xl font-bold" id="price-impact-heading">
          Market what-if analysis
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Apply adjustments to all {propertyCount} properties in this segment.
          Each property is predicted once at baseline and once in the scenario.
        </p>
      </div>
      <form
        aria-busy={isNavigating}
        className="space-y-4"
        onSubmit={applyScenario}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            School rating change
            <input
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              inputMode="decimal"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDraft((current) => ({
                  ...current,
                  schoolRatingDelta: value,
                }));
              }}
              step="any"
              type="number"
              value={draft.schoolRatingDelta}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Square footage change (%)
            <input
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              inputMode="decimal"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDraft((current) => ({
                  ...current,
                  squareFootagePercent: value,
                }));
              }}
              step="any"
              type="number"
              value={draft.squareFootagePercent}
            />
          </label>
        </div>
        {scenario !== undefined ? (
          <p className="text-sm text-slate-600">
            Leave both fields blank to clear the applied scenario.
          </p>
        ) : null}
        {propertyCount === 0 ? (
          <p className="text-sm text-slate-600" role="status">
            Scenario analysis is unavailable because no properties match these
            filters.
          </p>
        ) : null}
        <button
          className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={
            propertyCount === 0 ||
            isNavigating ||
            (!hasEffectiveDraft && scenario === undefined)
          }
          type="submit"
        >
          {isNavigating ? "Applying scenario…" : "Apply scenario"}
        </button>
      </form>

      {pending ? (
        <p className="text-sm text-slate-600" role="status">
          Calculating market predictions…
        </p>
      ) : null}
      {requestError ? (
        <p
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-900"
          role="alert"
        >
          {requestError}
        </p>
      ) : null}
      {result ? <ImpactResults result={result} /> : null}
    </section>
  );
}
