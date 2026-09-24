import type { EstimateRecord } from "@/lib/types";
import type { PropertyFeatures } from "@/lib/types";

export const estimateFeatureLabels: Array<{
  key: keyof PropertyFeatures;
  label: string;
}> = [
  { key: "square_footage", label: "Square footage" },
  { key: "bedrooms", label: "Bedrooms" },
  { key: "bathrooms", label: "Bathrooms" },
  { key: "year_built", label: "Year built" },
  { key: "lot_size", label: "Lot size" },
  { key: "distance_to_city_center", label: "Distance to city center" },
  { key: "school_rating", label: "School rating" },
];

export function formatEstimateLabel(
  record: Pick<EstimateRecord, "display_number">,
) {
  return `Estimate #${record.display_number}`;
}
