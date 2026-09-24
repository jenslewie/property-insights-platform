"use client";

import { useState } from "react";
import {
  filterSearchParams,
  matchesSegment,
} from "@/lib/market-analysis/filters";
import type {
  FeatureDimension,
  SegmentFilters,
} from "@/lib/market-analysis/fields";
import type { MarketDashboardData } from "@/lib/market-analysis/server-api";
import type { PropertyRecord } from "@/lib/market-analysis/schemas";
import { ExportControls } from "./export-controls";
import { PriceImpact } from "./price-impact";
import { PropertyTable } from "./property-table";

type Props = {
  data: MarketDashboardData;
  filters: SegmentFilters;
  dimension: FeatureDimension;
};

const featureLabels: Record<FeatureDimension, string> = {
  square_footage: "Square footage",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  year_built: "Year built",
  lot_size: "Lot size",
  distance_to_city_center: "Distance to city center",
  school_rating: "School rating",
};

export function MarketWorkspace({ data, filters, dimension }: Props) {
  const [selected, setSelected] = useState<PropertyRecord | null>(null);
  const filtersKey = filterSearchParams(filters).toString();
  const [previousFiltersKey, setPreviousFiltersKey] = useState(filtersKey);

  if (filtersKey !== previousFiltersKey) {
    setPreviousFiltersKey(filtersKey);
    if (selected && !matchesSegment(selected, filters)) {
      setSelected(null);
    }
  }

  const activeSelection =
    selected && matchesSegment(selected, filters) ? selected : null;

  return (
    <div className="space-y-8">
      <ExportControls
        filters={filters}
        matchedCount={data.summary.matched_count}
      />
      <PropertyTable
        filters={filters}
        onSelect={(property) => setSelected({ ...property })}
        properties={data.properties.properties}
      />
      <section
        aria-label={`Price impact workspace for ${featureLabels[dimension]}`}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div>
          <h2 className="text-2xl font-bold">Price impact workspace</h2>
          <p className="mt-1 text-sm text-slate-600">
            Feature distribution: {featureLabels[dimension]}.
          </p>
        </div>
        {activeSelection ? (
          <div
            className="space-y-3"
            aria-labelledby="selected-property-heading"
          >
            <h3
              className="text-lg font-semibold"
              id="selected-property-heading"
            >
              Selected property #{activeSelection.id}
            </h3>
            <PriceImpact property={activeSelection} />
          </div>
        ) : (
          <p className="text-slate-700" role="status">
            Select a sample property to compare.
          </p>
        )}
      </section>
    </div>
  );
}
