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
  marketFields,
  type MarketField,
  type SegmentFilters,
} from "@/lib/market-analysis/fields";
import { SideDrawer } from "./side-drawer";

type Props = {
  filters: SegmentFilters;
  scenario?: MarketScenario;
  dimension: import("@/lib/market-analysis/fields").FeatureDimension;
};

type FilterKey = keyof SegmentFilters;

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
  const label = field.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function filterChip(key: FilterKey, value: number) {
  const prefix = key.startsWith("min_") ? "min" : "max";
  const field = key.slice(prefix.length + 1) as MarketField;
  const operator = prefix === "min" ? "≥" : "≤";
  return `${fieldLabel(field)} ${operator} ${value}`;
}

export function SegmentFiltersForm({ filters, scenario, dimension }: Props) {
  return <SegmentFiltersFormState {...{ filters, scenario, dimension }} />;
}

function SegmentFiltersFormState({ filters, scenario, dimension }: Props) {
  const router = useRouter();
  const appliedKey = `${filterSearchParams(filters).toString()}|${JSON.stringify(scenario)}|${dimension}`;
  const [previousAppliedKey, setPreviousAppliedKey] = useState(appliedKey);
  const [draft, setDraft] = useState(() => initialDraft(filters));
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeCount = Object.keys(filters).length;
  const draftHasFilters = Object.values(draft).some(
    (value) => value.trim() !== "",
  );

  if (previousAppliedKey !== appliedKey) {
    setPreviousAppliedKey(appliedKey);
    setDraft(initialDraft(filters));
    setError(null);
    setOpen(false);
  }

  function close() {
    setDraft(initialDraft(filters));
    setError(null);
    setOpen(false);
  }

  function navigate(nextFilters: SegmentFilters) {
    const current = filterSearchParams(filters).toString();
    const next = filterSearchParams(nextFilters).toString();
    if (current === next) return;
    const query = dashboardSearchParams(
      nextFilters,
      dimension,
      scenario,
    ).toString();
    startTransition(() => router.push(`/market-analysis?${query}`));
  }

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const active = Object.fromEntries(
      Object.entries(draft).filter(([, value]) => value.trim() !== ""),
    );
    const parsed = parseMarketQuery(active);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setError(null);
    navigate(parsed.filters);
    setOpen(false);
  }

  function reset() {
    setDraft({});
    setError(null);
    setOpen(false);
    navigate({});
  }

  function removeFilter(key: FilterKey) {
    const next = { ...filters };
    delete next[key];
    navigate(next);
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <button
          aria-expanded={open}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          onClick={() => setOpen(true)}
          type="button"
        >
          Filters ({activeCount})
        </button>
        {activeCount > 0 ? (
          <div aria-label="Active filters" className="flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, value]) => {
              const label = filterChip(key as FilterKey, value);
              return (
                <button
                  aria-label={`Remove filter ${label}`}
                  className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-950 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  key={key}
                  onClick={() => removeFilter(key as FilterKey)}
                  type="button"
                >
                  <span>{label}</span>
                  <span aria-hidden="true">×</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <SideDrawer open={open} onClose={close} title="Filters">
        <p className="text-sm text-slate-600">
          Filter properties used throughout this dashboard. Bounds are
          inclusive; leave a bound empty to include all values on that side.
        </p>
        <form aria-busy={isPending} className="mt-5 space-y-5" onSubmit={apply}>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {marketFields.map((field) => (
              <fieldset className="min-w-0 space-y-2" key={field}>
                <legend className="font-medium capitalize text-slate-800">
                  {fieldLabel(field)}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["min", "max"] as const).map((prefix) => {
                    const key = `${prefix}_${field}`;
                    const label = `${prefix === "min" ? "Minimum" : "Maximum"} ${field.replaceAll("_", " ")}`;
                    return (
                      <label className="block text-sm text-slate-700" key={key}>
                        {prefix === "min" ? "Min" : "Max"}
                        <input
                          aria-label={label}
                          data-drawer-autofocus={
                            field === marketFields[0] && prefix === "min"
                              ? "true"
                              : undefined
                          }
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
                </div>
              </fieldset>
            ))}
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
          <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4">
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60"
              disabled={isPending || !draftHasFilters}
              onClick={reset}
              type="button"
            >
              Reset filters
            </button>
            <div className="flex gap-3">
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                onClick={close}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60"
                disabled={isPending}
                type="submit"
              >
                Apply filters
              </button>
            </div>
          </div>
        </form>
      </SideDrawer>
    </div>
  );
}
