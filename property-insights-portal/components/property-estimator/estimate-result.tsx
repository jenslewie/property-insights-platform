import type { EstimateResponse } from "@/lib/types";
import { formatNumericValue } from "@/lib/number-format";

export function EstimateResultView({
  estimate,
}: {
  estimate: EstimateResponse;
}) {
  return (
    <section
      aria-labelledby="latest-estimate"
      className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"
    >
      <h2 className="text-xl font-semibold" id="latest-estimate">
        Latest estimate
      </h2>

      <p className="mt-2 text-3xl font-bold text-emerald-900">
        {formatNumericValue(estimate.predicted_price)}
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Submitted property features</caption>
          <tbody>
            {Object.entries(estimate.property).map(([name, value]) => (
              <tr className="border-t border-emerald-200" key={name}>
                <th className="py-2 pr-4 font-medium">
                  {name.replaceAll("_", " ")}
                </th>
                <td className="py-2">
                  {typeof value === "number"
                    ? formatNumericValue(value)
                    : value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
