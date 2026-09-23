import type { EstimateRecord } from "@/lib/types";
import { formatNumericValue } from "@/lib/number-format";

type Props = {
  history: EstimateRecord[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
};

export function EstimateHistory({
  history,
  selectedIds,
  onToggle,
  onRemove,
  onClear,
}: Props) {
  if (history.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-slate-600">
        No saved estimates yet.
      </p>
    );
  }

  return (
    <section aria-labelledby="estimate-history" className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold" id="estimate-history">
          Estimate history
        </h2>

        <button
          className="text-sm font-semibold text-red-700 underline-offset-4 hover:underline"
          onClick={onClear}
          type="button"
        >
          Clear history
        </button>
      </div>

      <ul className="grid gap-4 md:grid-cols-2">
        {history.map((record, index) => {
          const number = history.length - index;

          return (
            <li
              className="rounded-xl border border-slate-200 bg-white p-4"
              key={record.id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">Estimate {number}</h3>
                  <p className="text-2xl font-bold text-blue-800">
                    {formatNumericValue(record.predicted_price)}
                  </p>
                  <p className="text-sm text-slate-600">
                    Square footage:{" "}
                    {formatNumericValue(record.property.square_footage)} ·{" "}
                    {record.property.bedrooms} bedrooms
                  </p>
                </div>

                <button
                  aria-label={`Remove estimate ${number}`}
                  className="text-sm text-red-700"
                  onClick={() => onRemove(record.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm font-medium">
                <input
                  checked={selectedIds.includes(record.id)}
                  onChange={() => onToggle(record.id)}
                  type="checkbox"
                />
                Compare estimate {number}
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
