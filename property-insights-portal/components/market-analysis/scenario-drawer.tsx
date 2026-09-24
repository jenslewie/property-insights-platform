"use client";

import { useState } from "react";
import {
  conditionSearchParams,
  dashboardSearchParams,
  type MarketScenario,
} from "@/lib/market-analysis/filters";
import {
  type FeatureDimension,
  type MarketField,
  type SegmentFilters,
} from "@/lib/market-analysis/fields";
import { SideDrawer } from "./side-drawer";

type Props = {
  filters: SegmentFilters;
  scenario?: MarketScenario;
  dimension: FeatureDimension;
  propertyCount: number;
  segmentReady?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ScenarioField = keyof MarketScenario;
type ScenarioFieldDefinition = {
  key: ScenarioField;
  label: string;
  chipLabel: string;
  suffix?: string;
  step: "any" | "1";
  autofocus?: boolean;
};

const scenarioFields: readonly ScenarioFieldDefinition[] = [
  {
    key: "schoolRatingDelta",
    label: "School rating change",
    chipLabel: "School rating",
    step: "any",
    autofocus: true,
  },
  {
    key: "squareFootagePercent",
    label: "Square footage change (%)",
    chipLabel: "Square footage",
    suffix: "%",
    step: "any",
  },
  {
    key: "bedroomsDelta",
    label: "Bedrooms change",
    chipLabel: "Bedrooms",
    step: "1",
  },
  {
    key: "bathroomsDelta",
    label: "Bathrooms change",
    chipLabel: "Bathrooms",
    step: "any",
  },
  {
    key: "yearBuiltDelta",
    label: "Year built change (years)",
    chipLabel: "Year built",
    suffix: " years",
    step: "1",
  },
  {
    key: "lotSizeDelta",
    label: "Lot size change",
    chipLabel: "Lot size",
    step: "1",
  },
  {
    key: "distanceToCityCenterDelta",
    label: "Distance to city center change",
    chipLabel: "Distance to city center",
    step: "any",
  },
];

type Draft = Record<ScenarioField, string>;

const integerScenarioFields = new Set<ScenarioField>([
  "bedroomsDelta",
  "yearBuiltDelta",
  "lotSizeDelta",
]);

function draftFromScenario(scenario?: MarketScenario): Draft {
  const draft = {} as Draft;
  for (const { key } of scenarioFields) {
    const value = scenario?.[key];
    draft[key] = value === undefined ? "" : String(value);
  }
  return draft;
}

function adjustmentCount(scenario?: MarketScenario): number {
  return scenario ? Object.keys(scenario).length : 0;
}

function fieldLabel(field: MarketField): string {
  const label = field.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function filterLabel(key: string, value: number): string {
  const prefix = key.startsWith("min_") ? "min" : "max";
  const field = key.slice(prefix.length + 1) as MarketField;
  return `${fieldLabel(field)} ${prefix === "min" ? "≥" : "≤"} ${value}`;
}

function adjustmentLabel(field: ScenarioField, value: number): string {
  const definition = scenarioFields.find((item) => item.key === field);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${definition?.chipLabel ?? field} ${sign}${Math.abs(value)}${definition?.suffix ?? ""}`;
}

function scenarioFromDraft(draft: Draft): MarketScenario | undefined {
  const scenario: MarketScenario = {};
  for (const { key } of scenarioFields) {
    const raw = draft[key].trim();
    const value = Number(raw);
    if (
      raw !== "" &&
      Number.isFinite(value) &&
      value !== 0 &&
      (!integerScenarioFields.has(key) || Number.isInteger(value))
    ) {
      scenario[key] = value;
    }
  }
  return Object.keys(scenario).length === 0 ? undefined : scenario;
}

export function ScenarioDrawer(props: Props) {
  return <ScenarioDrawerState {...props} />;
}

function ScenarioDrawerState({
  filters,
  scenario,
  dimension,
  propertyCount,
  segmentReady = true,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const appliedKey = `${conditionSearchParams(filters, scenario).toString()}|${dimension}`;
  const [draftState, setDraftState] = useState(() => ({
    key: appliedKey,
    value: draftFromScenario(scenario),
  }));
  const [internalOpenState, setInternalOpenState] = useState(() => ({
    key: appliedKey,
    value: false,
  }));
  const [error, setError] = useState<string | null>(null);

  if (draftState.key !== appliedKey) {
    setDraftState({ key: appliedKey, value: draftFromScenario(scenario) });
    setError(null);
  }
  if (internalOpenState.key !== appliedKey) {
    setInternalOpenState({ key: appliedKey, value: false });
  }

  const draft =
    draftState.key === appliedKey
      ? draftState.value
      : draftFromScenario(scenario);
  const internalOpen =
    internalOpenState.key === appliedKey && internalOpenState.value;
  const open = controlledOpen ?? internalOpen;
  const currentCount = adjustmentCount(scenario);
  const hasInvalidDraft = scenarioFields.some(({ key }) => {
    const raw = draft[key].trim();
    const value = Number(raw);
    return (
      raw !== "" &&
      (!Number.isFinite(value) ||
        (integerScenarioFields.has(key) && !Number.isInteger(value)))
    );
  });
  const hasEffectiveDraft = scenarioFromDraft(draft) !== undefined;

  function updateDraft(next: Draft | ((current: Draft) => Draft)) {
    const current =
      draftState.key === appliedKey
        ? draftState.value
        : draftFromScenario(scenario);
    setDraftState({
      key: appliedKey,
      value: typeof next === "function" ? next(current) : next,
    });
  }

  function changeOpen(nextOpen: boolean) {
    if (nextOpen && !segmentReady) return;
    if (onOpenChange) onOpenChange(nextOpen);
    else setInternalOpenState({ key: appliedKey, value: nextOpen });
  }

  function close() {
    updateDraft(draftFromScenario(scenario));
    setError(null);
    changeOpen(false);
  }

  function commit(nextScenario?: MarketScenario) {
    const query = dashboardSearchParams(
      filters,
      dimension,
      nextScenario,
    ).toString();
    const current = dashboardSearchParams(
      filters,
      dimension,
      scenario,
    ).toString();
    if (query !== current) {
      window.history.pushState(null, "", "/market-analysis?" + query);
    }
    changeOpen(false);
  }

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!segmentReady || propertyCount === 0) return;
    if (hasInvalidDraft) {
      setError("Enter a finite number for each scenario adjustment.");
      return;
    }
    const nextScenario = scenarioFromDraft(draft);
    if (nextScenario === undefined) {
      setError("Enter at least one non-zero scenario adjustment.");
      return;
    }
    setError(null);
    commit(nextScenario);
  }

  function clear() {
    updateDraft(draftFromScenario(undefined));
    setError(null);
    commit(undefined);
  }

  function removeAdjustment(field: ScenarioField) {
    const nextScenario = { ...scenario };
    delete nextScenario[field];
    commit(Object.keys(nextScenario).length === 0 ? undefined : nextScenario);
  }

  const buttonLabel =
    scenario === undefined
      ? "What-if scenario"
      : `Edit scenario (${currentCount})`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        aria-disabled={!segmentReady}
        aria-expanded={open}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        onClick={() => changeOpen(true)}
        type="button"
      >
        {buttonLabel}
      </button>
      {scenario !== undefined ? (
        <div aria-label="Applied scenario" className="flex flex-wrap gap-2">
          {scenarioFields.map(({ key }) => {
            const value = scenario[key];
            if (value === undefined) return null;
            const label = adjustmentLabel(key, value);
            return (
              <button
                aria-label={`Remove scenario ${label}`}
                className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm font-medium text-violet-950 hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
                key={key}
                onClick={() => removeAdjustment(key)}
                type="button"
              >
                <span>{label}</span>
                <span aria-hidden="true">×</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <SideDrawer open={open} onClose={close} title="What-if scenario">
        <div className="space-y-5">
          <div>
            <h3 className="font-semibold text-slate-900">Current segment</h3>
            <p className="mt-1 text-sm text-slate-700">
              {propertyCount} {propertyCount === 1 ? "property" : "properties"}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Active filters</h3>
            {Object.keys(filters).length ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {Object.entries(filters).map(([key, value]) => (
                  <li key={key}>{filterLabel(key, value)}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-slate-600">No active filters.</p>
            )}
          </div>
          <div className="border-t border-slate-200 pt-5">
            <h3 className="font-semibold text-slate-900">
              Scenario adjustments
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Apply adjustments to all {propertyCount} properties in this
              segment. Each property is predicted once at baseline and once in
              the scenario.
            </p>
          </div>
          {!segmentReady ? (
            <p className="text-sm text-slate-600" role="status">
              Updating this segment before scenario analysis is available.
            </p>
          ) : propertyCount === 0 ? (
            <p className="text-sm text-slate-600" role="status">
              Scenario analysis is unavailable because no properties match these
              filters.
            </p>
          ) : null}
          <form className="space-y-5" onSubmit={apply}>
            <div className="space-y-4">
              {scenarioFields.map(({ key, label, step, autofocus }) => (
                <label
                  className="block text-sm font-medium text-slate-700"
                  key={key}
                >
                  {label}
                  <input
                    aria-label={label}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    data-drawer-autofocus={autofocus ? "true" : undefined}
                    inputMode={step === "1" ? "numeric" : "decimal"}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      updateDraft((current) => ({
                        ...current,
                        [key]: value,
                      }));
                    }}
                    step={step}
                    type="number"
                    value={draft[key]}
                  />
                </label>
              ))}
              <p className="text-sm text-slate-600">Blank means no change.</p>
            </div>
            {error ? (
              <p className="text-sm text-red-800" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4">
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                disabled={scenario === undefined}
                onClick={clear}
                type="button"
              >
                Clear scenario
              </button>
              <div className="flex gap-3">
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={close}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={
                    !segmentReady ||
                    propertyCount === 0 ||
                    hasInvalidDraft ||
                    !hasEffectiveDraft
                  }
                  type="submit"
                >
                  Apply scenario
                </button>
              </div>
            </div>
          </form>
        </div>
      </SideDrawer>
    </div>
  );
}
