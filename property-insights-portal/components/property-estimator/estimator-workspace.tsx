"use client";

import { useEffect, useState } from "react";
import { useEstimateHistory } from "@/hooks/use-estimate-history";
import {
  MAX_COMPARISON_ESTIMATES,
  MIN_COMPARISON_ESTIMATES,
} from "@/lib/estimate-constants";
import type { EstimateRecord, EstimateResult } from "@/lib/types";
import { ComparisonView } from "./comparison-view";
import { EstimateForm } from "./estimate-form";
import { EstimateHistory } from "./estimate-history";
import { PredictionResults } from "./prediction-results";

type LatestResult = {
  mode: "single" | "batch";
  estimates: EstimateRecord[];
};

export function EstimatorWorkspace() {
  const [latestResult, setLatestResult] = useState<LatestResult | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [compareVersion, setCompareVersion] = useState(0);
  const historyState = useEstimateHistory();

  const comparisonRecords = comparisonIds.flatMap(
    (id) => historyState.history.find((record) => record.id === id) ?? [],
  );

  useEffect(() => {
    if (compareVersion === 0) {
      return;
    }

    const comparison = document.getElementById("estimate-comparison");
    if (!comparison) {
      return;
    }

    comparison.scrollIntoView?.({ behavior: "smooth", block: "start" });
    comparison.focus({ preventScroll: true });
  }, [compareVersion]);

  function handleSuccess(result: EstimateResult) {
    if ("estimates" in result) {
      const estimates = historyState.addEstimates(result.estimates);
      setLatestResult({ mode: "batch", estimates });
      return;
    }

    const estimate = historyState.addEstimate(result);
    setLatestResult({ mode: "single", estimates: [estimate] });
  }

  function handleCompare() {
    const selectedIds = historyState.selectedIds;
    if (
      selectedIds.length < MIN_COMPARISON_ESTIMATES ||
      selectedIds.length > MAX_COMPARISON_ESTIMATES
    ) {
      return;
    }

    setComparisonIds([...selectedIds]);
    setCompareVersion((current) => current + 1);
  }

  return (
    <div className="space-y-10">
      <EstimateForm onSuccessAction={handleSuccess} />

      {latestResult ? (
        <PredictionResults
          estimates={latestResult.estimates}
          mode={latestResult.mode}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-slate-600">
          Submit the form to see an estimate.
        </p>
      )}

      {historyState.isHydrated ? (
        <>
          <EstimateHistory
            history={historyState.history}
            onClear={historyState.clearHistory}
            onClearSelection={historyState.clearSelection}
            onCompare={handleCompare}
            onRemove={historyState.removeEstimate}
            onToggle={historyState.toggleSelected}
            selectedIds={historyState.selectedIds}
          />
          {comparisonRecords.length >= MIN_COMPARISON_ESTIMATES ? (
            <ComparisonView estimates={comparisonRecords} />
          ) : null}
        </>
      ) : (
        <p className="text-slate-600">Loading estimate history…</p>
      )}
    </div>
  );
}
