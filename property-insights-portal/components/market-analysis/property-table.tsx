"use client";

import { useMemo, useState } from "react";
import { filterSearchParams } from "@/lib/market-analysis/filters";
import { formatNumericValue } from "@/lib/number-format";
import { matchesSegment } from "@/lib/market-analysis/filters";
import type { SegmentFilters } from "@/lib/market-analysis/fields";
import type { PropertyRecord } from "@/lib/market-analysis/schemas";

const pageSize = 10;
const columns = [
  ["square_footage", "Square footage"],
  ["bedrooms", "Bedrooms"],
  ["bathrooms", "Bathrooms"],
  ["year_built", "Year built"],
  ["lot_size", "Lot size"],
  ["distance_to_city_center", "Distance to city center"],
  ["school_rating", "School rating"],
  ["price", "Price"],
] as const;
type SortField = keyof PropertyRecord;

type Props = {
  properties: PropertyRecord[];
  filters: SegmentFilters;
};

function searchableText(property: PropertyRecord): string {
  return Object.values(property).join(" ").toLowerCase();
}

function sortValue(property: PropertyRecord, field: SortField): number {
  return property[field];
}

export function PropertyTable(props: Props) {
  const filtersKey = filterSearchParams(props.filters).toString();
  return <PropertyTableView key={filtersKey} {...props} />;
}

function PropertyTableView({ properties, filters }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{
    field: SortField;
    ascending: boolean;
  } | null>(null);

  const segmentProperties = useMemo(
    () => properties.filter((property) => matchesSegment(property, filters)),
    [properties, filters],
  );
  const matchingProperties = useMemo(
    () =>
      segmentProperties.filter((property) =>
        searchableText(property).includes(search.trim().toLowerCase()),
      ),
    [segmentProperties, search],
  );
  const orderedProperties = useMemo(() => {
    if (!sort) return matchingProperties;
    return matchingProperties
      .map((property, index) => ({ property, index }))
      .sort((left, right) => {
        const difference =
          sortValue(left.property, sort.field) -
          sortValue(right.property, sort.field);
        return (
          (sort.ascending ? difference : -difference) ||
          left.index - right.index
        );
      })
      .map(({ property }) => property);
  }, [matchingProperties, sort]);
  const pageCount = Math.max(1, Math.ceil(orderedProperties.length / pageSize));
  const visibleProperties = orderedProperties.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  function toggleSort(field: SortField) {
    setSort((current) => ({
      field,
      ascending: current?.field === field ? !current.ascending : true,
    }));
    setPage(1);
  }

  return (
    <section className="space-y-4" aria-labelledby="property-table-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" id="property-table-heading">
            Sample properties
          </h2>
          <p aria-live="polite" className="mt-1 text-sm text-slate-600">
            {matchingProperties.length}{" "}
            {matchingProperties.length === 1 ? "property" : "properties"}
            {search.trim()
              ? ` shown of ${segmentProperties.length} in this segment.`
              : ` in this segment.`}
          </p>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Search properties
          <input
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:w-72"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setSearch(value);
              setPage(1);
            }}
            type="search"
            value={search}
          />
        </label>
      </div>

      {visibleProperties.length === 0 ? (
        <p
          className="rounded-xl border border-slate-300 bg-white p-5 text-slate-700"
          role="status"
        >
          No properties match the current table filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[70rem] text-left text-sm">
            <caption className="sr-only">
              Property records in the selected market segment
            </caption>
            <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="whitespace-nowrap p-3" scope="col">
                  Property ID
                </th>
                {columns.map(([field, label]) => (
                  <th
                    aria-sort={
                      sort?.field === field
                        ? sort.ascending
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className="whitespace-nowrap p-3"
                    key={field}
                    scope="col"
                  >
                    <button
                      aria-label={`Sort by ${label.toLowerCase()}`}
                      className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                      onClick={() => toggleSort(field)}
                      type="button"
                    >
                      {label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleProperties.map((property) => (
                <tr className="border-t border-slate-200" key={property.id}>
                  <th className="whitespace-nowrap p-3 font-medium" scope="row">
                    <span className="sr-only">Property </span>
                    {property.id}
                  </th>
                  {columns.map(([field]) => (
                    <td className="whitespace-nowrap p-3" key={field}>
                      {formatNumericValue(property[field])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3" aria-label="Table pagination">
        <button
          className="rounded-lg border border-slate-300 px-3 py-2 font-medium disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          type="button"
        >
          Previous page
        </button>
        <p aria-live="polite" className="text-sm text-slate-600">
          Page {page} of {pageCount}
        </p>
        <button
          className="rounded-lg border border-slate-300 px-3 py-2 font-medium disabled:opacity-50"
          disabled={page >= pageCount}
          onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          type="button"
        >
          Next page
        </button>
      </div>
    </section>
  );
}
