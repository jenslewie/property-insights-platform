import {
  MAX_COMPARISON_ESTIMATES,
  MIN_COMPARISON_ESTIMATES,
} from "@/lib/estimate-constants";
import {
  estimateFeatureLabels,
  formatEstimateLabel,
} from "@/lib/estimate-display";
import type { EstimateRecord } from "@/lib/types";
import { formatNumericValue } from "@/lib/number-format";
import { EstimateChart } from "./estimate-chart";

export function ComparisonView({ estimates }: { estimates: EstimateRecord[] }) {
  if (
    estimates.length < MIN_COMPARISON_ESTIMATES ||
    estimates.length > MAX_COMPARISON_ESTIMATES
  ) {
    return null;
  }

  return (
    <section
      aria-labelledby="property-comparison-heading"
      className="scroll-mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      id="estimate-comparison"
      tabIndex={-1}
    >
      <h2 className="text-2xl font-semibold" id="property-comparison-heading">
        Property comparison
      </h2>

      <EstimateChart
        chartLabel="Bar chart comparing predicted property prices"
        records={estimates}
        title="Price comparison"
      />

      <div className="rounded-xl border border-slate-200 bg-white">
        <table
          aria-label="Side-by-side property comparison"
          className="block w-full min-w-0 text-left text-sm xl:table xl:table-fixed"
          role="table"
        >
          <caption className="sr-only">
            Side-by-side property comparison
          </caption>
          <thead
            className="sr-only xl:not-sr-only xl:table-header-group xl:bg-slate-100 xl:text-xs xl:font-semibold xl:uppercase xl:tracking-wide xl:text-slate-600"
            role="rowgroup"
          >
            <tr role="row">
              <th className="break-words p-3" role="columnheader" scope="col">
                Feature
              </th>
              {estimates.map((estimate) => (
                <th
                  className="break-words p-3"
                  key={estimate.id}
                  role="columnheader"
                  scope="col"
                >
                  {formatEstimateLabel(estimate)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            className="block space-y-3 p-3 xl:table-row-group xl:space-y-0 xl:p-0"
            role="rowgroup"
          >
            <tr
              className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-3 xl:table-row xl:rounded-none xl:border-0 xl:border-t xl:p-0"
              role="row"
            >
              <th
                className="col-span-2 min-w-0 break-words p-0 font-semibold xl:table-cell xl:p-3"
                role="rowheader"
                scope="row"
              >
                Predicted price
              </th>
              {estimates.map((estimate) => (
                <td
                  className="min-w-0 break-words p-0 tabular-nums before:mb-1 before:block before:text-xs before:font-medium before:text-slate-600 before:content-[attr(data-label)] xl:table-cell xl:p-3 xl:before:hidden"
                  data-label={formatEstimateLabel(estimate)}
                  key={estimate.id}
                  role="cell"
                >
                  {formatNumericValue(estimate.predicted_price)}
                </td>
              ))}
            </tr>
            {estimateFeatureLabels.map(({ key, label }) => (
              <tr
                className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-3 xl:table-row xl:rounded-none xl:border-0 xl:border-t xl:p-0"
                key={key}
                role="row"
              >
                <th
                  className="col-span-2 min-w-0 break-words p-0 font-semibold xl:table-cell xl:p-3"
                  role="rowheader"
                  scope="row"
                >
                  {label}
                </th>
                {estimates.map((estimate) => (
                  <td
                    className="min-w-0 break-words p-0 tabular-nums before:mb-1 before:block before:text-xs before:font-medium before:text-slate-600 before:content-[attr(data-label)] xl:table-cell xl:p-3 xl:before:hidden"
                    data-label={formatEstimateLabel(estimate)}
                    key={estimate.id}
                    role="cell"
                  >
                    {formatNumericValue(estimate.property[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
