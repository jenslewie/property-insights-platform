"use client";

import { useState } from "react";
import { useEstimateHistory } from "@/hooks/use-estimate-history";
import type { EstimateResult } from "@/lib/types";
import { EstimateChart } from "./estimate-chart";
import { EstimateForm } from "./estimate-form";
import { EstimateHistory } from "./estimate-history";
import { EstimateResultView } from "./estimate-result";

export function EstimatorWorkspace() {
  const [latest, setLatest] = useState<EstimateResult | null>(null);
  const historyState = useEstimateHistory();

  function handleSuccess(result: EstimateResult) {
    setLatest(result);

    if ("estimates" in result) {
      historyState.addEstimates(result.estimates);
    } else {
      historyState.addEstimate(result);
    }
  }

  const chartRecords =
    historyState.selectedRecords.length > 0
      ? historyState.selectedRecords
      : historyState.history.slice(0, 1);

  return (
    <div className="space-y-10">
      <div className="space-y-8">
        <EstimateForm onSuccessAction={handleSuccess} />

        <div aria-live="polite">
          {latest && "estimates" in latest ? (
            <section
              aria-labelledby="latest-batch"
              className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"
            >
              <h2 className="text-xl font-semibold" id="latest-batch">
                Latest batch
              </h2>
              <p className="mt-2 text-emerald-900">
                {latest.count} {latest.count === 1 ? "estimate" : "estimates"}{" "}
                completed and added to the comparison.
              </p>
            </section>
          ) : latest ? (
            <EstimateResultView estimate={latest} />
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-slate-600">
              Submit the form to see an estimate.
            </p>
          )}
        </div>
      </div>

      {historyState.isHydrated ? (
        <>
          <EstimateChart records={chartRecords} />

          <EstimateHistory
            history={historyState.history}
            onClear={historyState.clearHistory}
            onRemove={historyState.removeEstimate}
            onToggle={historyState.toggleSelected}
            selectedIds={historyState.selectedIds}
          />
        </>
      ) : (
        <p className="text-slate-600">Loading estimate history…</p>
      )}
    </div>
  );
}
