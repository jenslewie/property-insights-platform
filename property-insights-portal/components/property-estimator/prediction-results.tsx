import type { EstimateRecord } from "@/lib/types";
import {
  estimateFeatureLabels,
  formatEstimateLabel,
} from "@/lib/estimate-display";
import { formatNumericValue } from "@/lib/number-format";
import { EstimateChart } from "./estimate-chart";

type Props = {
  estimates: EstimateRecord[];
  mode: "single" | "batch";
};

export function PredictionResults({ estimates, mode }: Props) {
  if (estimates.length === 0) {
    return null;
  }

  const singleEstimate = estimates[0];

  return (
    <section
      aria-labelledby="prediction-results-heading"
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header>
        <h2 className="text-2xl font-semibold" id="prediction-results-heading">
          Prediction results
        </h2>
        {mode === "single" ? (
          <div className="mt-3">
            <p className="text-sm text-slate-600">
              Latest estimate · {formatEstimateLabel(singleEstimate)}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">
              Predicted value
            </p>
            <p className="text-3xl font-bold text-emerald-900">
              {formatNumericValue(singleEstimate.predicted_price)}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-slate-600">
            Latest batch · {estimates.length}{" "}
            {estimates.length === 1 ? "estimate" : "estimates"}
          </p>
        )}
      </header>

      <EstimateChart
        chartLabel="Bar chart showing predicted property prices"
        records={estimates}
        title="Predicted price"
      />

      <div className="rounded-xl border border-slate-200 bg-white">
        <table
          aria-label="Prediction results"
          className="block w-full min-w-0 text-left text-sm xl:table xl:table-fixed"
          role="table"
        >
          <caption className="sr-only">Prediction results</caption>
          <thead
            className="sr-only xl:not-sr-only xl:table-header-group xl:bg-slate-100 xl:text-xs xl:font-semibold xl:uppercase xl:tracking-wide xl:text-slate-600"
            role="rowgroup"
          >
            <tr role="row">
              <th className="break-words p-3" role="columnheader" scope="col">
                Estimate
              </th>
              {estimateFeatureLabels.map(({ key, label }) => (
                <th
                  className="break-words p-3"
                  key={key}
                  role="columnheader"
                  scope="col"
                >
                  {label}
                </th>
              ))}
              <th className="break-words p-3" role="columnheader" scope="col">
                Predicted price
              </th>
            </tr>
          </thead>
          <tbody
            className="block space-y-3 p-3 xl:table-row-group xl:space-y-0 xl:p-0"
            role="rowgroup"
          >
            {estimates.map((estimate) => (
              <tr
                className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-3 xl:table-row xl:rounded-none xl:border-0 xl:border-t xl:p-0"
                key={estimate.id}
                role="row"
              >
                <th
                  className="col-span-2 min-w-0 break-words p-0 font-semibold xl:table-cell xl:p-3"
                  role="rowheader"
                  scope="row"
                >
                  {formatEstimateLabel(estimate)}
                </th>
                {estimateFeatureLabels.map(({ key, label }) => (
                  <td
                    className="min-w-0 break-words p-0 tabular-nums before:mb-1 before:block before:text-xs before:font-medium before:text-slate-600 before:content-[attr(data-label)] xl:table-cell xl:p-3 xl:before:hidden"
                    data-label={label}
                    key={key}
                    role="cell"
                  >
                    {formatNumericValue(estimate.property[key])}
                  </td>
                ))}
                <td
                  className="col-span-2 min-w-0 break-words border-t border-slate-200 p-2 font-semibold tabular-nums before:mb-1 before:block before:text-xs before:font-medium before:text-slate-600 before:content-[attr(data-label)] xl:table-cell xl:border-0 xl:p-3 xl:before:hidden"
                  data-label="Predicted price"
                  role="cell"
                >
                  {formatNumericValue(estimate.predicted_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
