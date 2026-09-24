"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  dashboardSearchParams,
  filterSearchParams,
  parseMarketQuery,
  type MarketScenario,
} from "@/lib/market-analysis/filters";
import {
  featureDimensions,
  marketFields,
  type FeatureDimension,
  type MarketField,
  type SegmentFilters,
} from "@/lib/market-analysis/fields";

type Props = {
  filters: SegmentFilters;
  scenario?: MarketScenario;
  dimension: FeatureDimension;
};

const integerFields = new Set<MarketField>([
  "square_footage",
  "bedrooms",
  "year_built",
  "lot_size",
]);

function initialDraft(filters: SegmentFilters): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const field of marketFields) {
    for (const prefix of ["min", "max"] as const) {
      const key = `${prefix}_${field}` as keyof SegmentFilters;
      const value = filters[key];
      if (value !== undefined) draft[key] = String(value);
    }
  }
  return draft;
}

function fieldLabel(field: MarketField): string {
  return field.replaceAll("_", " ");
}

export function SegmentFiltersForm({ filters, scenario, dimension }: Props) {
  const formKey = `${filterSearchParams(filters).toString()}|${JSON.stringify(scenario)}|${dimension}`;
  return (
    <SegmentFiltersFormState
      key={formKey}
      dimension={dimension}
      filters={filters}
      scenario={scenario}
    />
  );
}

function SegmentFiltersFormState({ filters, scenario, dimension }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => initialDraft(filters));
  const [selectedDimension, setSelectedDimension] = useState(dimension);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const active = Object.fromEntries(
      Object.entries(draft).filter(([, value]) => value.trim() !== ""),
    );
    const parsed = parseMarketQuery({
      ...active,
      chart_dimension: selectedDimension,
    });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setError(null);
    const query = dashboardSearchParams(
      parsed.filters,
      parsed.dimension,
      scenario,
    ).toString();
    startTransition(() => router.push(`/market-analysis?${query}`));
  }

  function reset() {
    setDraft({});
    setError(null);
    const query = dashboardSearchParams(
      {},
      selectedDimension,
      scenario,
    ).toString();
    startTransition(() => router.push(`/market-analysis?${query}`));
  }

  return (
    <section
      aria-labelledby="segment-filter-heading"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-xl font-semibold" id="segment-filter-heading">
        Segment filters
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Bounds are inclusive. Leave a bound empty to include all values on that
        side.
      </p>
      <form aria-busy={isPending} className="mt-5 space-y-5" onSubmit={apply}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {marketFields.map((field) => (
            <fieldset className="space-y-2" key={field}>
              <legend className="font-medium capitalize text-slate-800">
                {fieldLabel(field)}
              </legend>
              {(["min", "max"] as const).map((prefix) => {
                const key = `${prefix}_${field}`;
                const label = `${prefix === "min" ? "Minimum" : "Maximum"} ${fieldLabel(field)}`;
                return (
                  <label className="block text-sm text-slate-700" key={key}>
                    {label}
                    <input
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                      inputMode={
                        integerFields.has(field) ? "numeric" : "decimal"
                      }
                      name={key}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setDraft((current) => ({
                          ...current,
                          [key]: value,
                        }));
                      }}
                      step={integerFields.has(field) ? 1 : "any"}
                      type="number"
                      value={draft[key] ?? ""}
                    />
                  </label>
                );
              })}
            </fieldset>
          ))}
          <label className="block text-sm font-medium text-slate-700">
            Feature distribution
            <select
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              onChange={(event) =>
                setSelectedDimension(
                  event.currentTarget.value as FeatureDimension,
                )
              }
              value={selectedDimension}
            >
              {featureDimensions.map((feature) => (
                <option key={feature} value={feature}>
                  {fieldLabel(feature)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? (
          <p className="text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        {isPending ? (
          <p className="text-sm text-slate-600" role="status">
            Applying filters…
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            Apply filters
          </button>
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60"
            disabled={isPending}
            onClick={reset}
            type="button"
          >
            Reset filters
          </button>
        </div>
      </form>
    </section>
  );
}
