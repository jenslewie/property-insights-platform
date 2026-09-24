"use client";

import type {
  FeatureDimension,
  SegmentFilters,
} from "@/lib/market-analysis/fields";
import type { MarketScenario } from "@/lib/market-analysis/filters";
import type { MarketDashboardData } from "@/lib/market-analysis/server-api";
import { ExportControls } from "./export-controls";
import { PriceImpact } from "./price-impact";
import { PropertyTable } from "./property-table";

type Props = {
  data: MarketDashboardData;
  filters: SegmentFilters;
  scenario: MarketScenario | undefined;
  dimension: FeatureDimension;
};

export function MarketWorkspace({ data, filters, scenario, dimension }: Props) {
  return (
    <div className="space-y-8">
      <ExportControls
        filters={filters}
        scenario={scenario}
        matchedCount={data.summary.matched_count}
      />
      <PriceImpact
        dimension={dimension}
        filters={filters}
        propertyCount={data.summary.matched_count}
        scenario={scenario}
      />
      <PropertyTable
        filters={filters}
        properties={data.properties.properties}
      />
    </div>
  );
}
