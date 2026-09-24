"use client";

import { Fragment, useState } from "react";
import {
  HISTORY_PAGE_SIZE,
  MAX_COMPARISON_ESTIMATES,
  MIN_COMPARISON_ESTIMATES,
} from "@/lib/estimate-constants";
import {
  estimateFeatureLabels,
  formatEstimateLabel,
} from "@/lib/estimate-display";
import type { EstimateRecord } from "@/lib/types";
import { formatNumericValue } from "@/lib/number-format";

type Props = {
  history: EstimateRecord[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onClearSelection: () => void;
  onCompare: () => void;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function EstimateHistory({
  history,
  selectedIds,
  onToggle,
  onRemove,
  onClear,
  onClearSelection,
  onCompare,
}: Props) {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const pageCount = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRecords = history.slice(
    (currentPage - 1) * HISTORY_PAGE_SIZE,
    currentPage * HISTORY_PAGE_SIZE,
  );
  const selectedCount = selectedIds.length;

  return (
    <section aria-labelledby="estimate-history" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold" id="estimate-history">
          Estimate history
        </h2>

        {history.length > 0 && !confirmingClear ? (
          <button
            className="text-sm font-medium text-slate-600 underline-offset-4 hover:underline"
            onClick={() => setConfirmingClear(true)}
            type="button"
          >
            Clear history
          </button>
        ) : null}

        {confirmingClear ? (
          <div
            aria-label="Clear all estimate history?"
            className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2"
            role="group"
          >
            <p className="font-medium">Clear all estimate history?</p>
            <button
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium"
              onClick={() => setConfirmingClear(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-semibold text-white"
              onClick={() => {
                setConfirmingClear(false);
                onClear();
              }}
              type="button"
            >
              Confirm clear history
            </button>
          </div>
        ) : null}
      </div>

      {history.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-slate-600">
          No saved estimates yet.
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white">
            <table
              aria-label="Estimate history"
              className="block w-full min-w-0 text-left text-sm xl:table xl:table-fixed"
              role="table"
            >
              <caption className="sr-only">Estimate history</caption>
              <thead
                className="sr-only xl:not-sr-only xl:table-header-group xl:bg-slate-100 xl:text-xs xl:font-semibold xl:uppercase xl:tracking-wide xl:text-slate-600"
                role="rowgroup"
              >
                <tr role="row">
                  <th className="p-3" role="columnheader" scope="col">
                    <span className="sr-only">Select</span>
                  </th>
                  <th
                    className="break-words p-3"
                    role="columnheader"
                    scope="col"
                  >
                    Estimate
                  </th>
                  <th
                    className="break-words p-3"
                    role="columnheader"
                    scope="col"
                  >
                    Predicted price
                  </th>
                  <th
                    className="break-words p-3"
                    role="columnheader"
                    scope="col"
                  >
                    Square footage
                  </th>
                  <th
                    className="break-words p-3"
                    role="columnheader"
                    scope="col"
                  >
                    Bedrooms
                  </th>
                  <th
                    className="break-words p-3"
                    role="columnheader"
                    scope="col"
                  >
                    Bathrooms
                  </th>
                  <th
                    className="break-words p-3"
                    role="columnheader"
                    scope="col"
                  >
                    Created
                  </th>
                  <th className="p-3" role="columnheader" scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody
                className="grid gap-3 p-3 xl:table-row-group xl:gap-0 xl:p-0"
                role="rowgroup"
              >
                {pageRecords.map((record) => {
                  const label = formatEstimateLabel(record);
                  const isSelected = selectedIds.includes(record.id);
                  const isExpanded = expandedId === record.id;
                  const detailsId = `estimate-details-${record.id}`;

                  return (
                    <Fragment key={record.id}>
                      <tr
                        className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-3 align-middle xl:table-row xl:rounded-none xl:border-0 xl:border-t xl:p-0"
                        key={record.id}
                        role="row"
                      >
                        <td
                          className="min-w-0 p-0 before:mb-1 before:block before:text-xs before:font-medium before:text-slate-600 before:content-[attr(data-label)] xl:table-cell xl:p-3 xl:before:hidden"
                          data-label="Select"
                          role="cell"
                        >
                          <input
                            aria-label={`Select ${label} for comparison`}
                            checked={isSelected}
                            disabled={
                              !isSelected &&
                              selectedCount >= MAX_COMPARISON_ESTIMATES
                            }
                            onChange={() => onToggle(record.id)}
                            type="checkbox"
                          />
                        </td>
                        <th
                          className="col-span-1 min-w-0 break-words p-0 font-semibold xl:table-cell xl:p-3"
                          role="rowheader"
                          scope="row"
                        >
                          {label}
                        </th>
                        <td
                          className="col-span-2 min-w-0 break-words p-0 font-semibold tabular-nums before:mb-1 before:block before:text-xs before:font-medium before:text-slate-600 before:content-[attr(data-label)] xl:table-cell xl:p-3 xl:before:hidden"
                          data-label="Predicted price"
                          role="cell"
                        >
                          {formatNumericValue(record.predicted_price)}
                        </td>
                        <td
                          className="min-w-0 break-words p-0 tabular-nums before:mb-1 before:block before:text-xs before:font-medium before:text-slate-600 before:content-[attr(data-label)] xl:table-cell xl:p-3 xl:before:hidden"
                          data-label="Square footage"
                          role="cell"
                        >
                          {formatNumericValue(record.property.square_footage)}
                        </td>
                        <td
                          className="min-w-0 break-words p-0 tabular-nums before:mb-1 before:block before:text-xs before:font-medium before:text-slate-600 before:content-[attr(data-label)] xl:table-cell xl:p-3 xl:before:hidden"
                          data-label="Bedrooms"
                          role="cell"
                        >
                          {formatNumericValue(record.property.bedrooms)}
                        </td>
                        <td
                          className="min-w-0 break-words p-0 tabular-nums before:mb-1 before:block before:text-xs before:font-medium before:text-slate-600 before:content-[attr(data-label)] xl:table-cell xl:p-3 xl:before:hidden"
                          data-label="Bathrooms"
                          role="cell"
                        >
                          {formatNumericValue(record.property.bathrooms)}
                        </td>
                        <td
                          className="min-w-0 break-words p-0 before:mb-1 before:block before:text-xs before:font-medium before:text-slate-600 before:content-[attr(data-label)] xl:table-cell xl:p-3 xl:before:hidden"
                          data-label="Created"
                          role="cell"
                        >
                          <time dateTime={record.created_at}>
                            {dateFormatter.format(new Date(record.created_at))}
                          </time>
                        </td>
                        <td
                          className="min-w-0 p-0 before:mb-1 before:block before:text-xs before:font-medium before:text-slate-600 before:content-[attr(data-label)] xl:table-cell xl:p-3 xl:before:hidden"
                          data-label="Actions"
                          role="cell"
                        >
                          <details className="relative">
                            <summary
                              className="cursor-pointer list-none rounded-md px-2 py-1 text-lg text-slate-600 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"
                              aria-label={`More actions for ${label}`}
                            >
                              ⋯
                            </summary>
                            <div className="absolute right-0 z-10 mt-1 min-w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                              <button
                                aria-expanded={isExpanded}
                                aria-controls={detailsId}
                                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-100"
                                onClick={() =>
                                  setExpandedId(isExpanded ? null : record.id)
                                }
                                type="button"
                              >
                                View details for {label}
                              </button>
                              <button
                                aria-label={`Remove ${label}`}
                                className="block w-full rounded px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
                                onClick={() => onRemove(record.id)}
                                type="button"
                              >
                                Remove
                              </button>
                            </div>
                          </details>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr
                          className="grid grid-cols-2 rounded-lg border border-slate-200 xl:table-row xl:rounded-none xl:border-0 xl:border-t"
                          key={detailsId}
                          role="row"
                        >
                          <td
                            className="col-span-2 block min-w-0 bg-slate-50 p-4 xl:table-cell"
                            colSpan={8}
                            role="cell"
                          >
                            <section
                              aria-label={`${label} details`}
                              id={detailsId}
                            >
                              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                                {estimateFeatureLabels.map(
                                  ({ key, label: name }) => (
                                    <div key={key}>
                                      <dt className="text-sm text-slate-600">
                                        {name}
                                      </dt>
                                      <dd className="font-medium tabular-nums">
                                        {formatNumericValue(
                                          record.property[key],
                                        )}
                                      </dd>
                                    </div>
                                  ),
                                )}
                                <div>
                                  <dt className="text-sm text-slate-600">
                                    Predicted price
                                  </dt>
                                  <dd className="font-medium tabular-nums">
                                    {formatNumericValue(record.predicted_price)}
                                  </dd>
                                </div>
                              </dl>
                            </section>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <p aria-live="polite" className="text-sm text-slate-600">
                {selectedCount} of {MAX_COMPARISON_ESTIMATES} estimates selected
              </p>
              {selectedCount > 0 ? (
                <button
                  className="text-sm font-medium text-slate-600 underline-offset-4 hover:underline"
                  onClick={onClearSelection}
                  type="button"
                >
                  Clear selection
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {history.length > HISTORY_PAGE_SIZE ? (
                <nav
                  aria-label="Estimate history pagination"
                  className="flex items-center gap-2"
                >
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:text-slate-400"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                    type="button"
                  >
                    Previous page
                  </button>
                  <span
                    aria-live="polite"
                    className="whitespace-nowrap text-sm text-slate-600"
                  >
                    Page {currentPage} of {pageCount}
                  </span>
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:text-slate-400"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(currentPage + 1)}
                    type="button"
                  >
                    Next page
                  </button>
                </nav>
              ) : null}
              <button
                className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={
                  selectedCount < MIN_COMPARISON_ESTIMATES ||
                  selectedCount > MAX_COMPARISON_ESTIMATES
                }
                onClick={onCompare}
                type="button"
              >
                Compare selected
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
