export const marketFields = [
  "square_footage",
  "bedrooms",
  "bathrooms",
  "year_built",
  "lot_size",
  "distance_to_city_center",
  "school_rating",
  "price",
] as const;

export const featureDimensions = [
  "square_footage",
  "bedrooms",
  "bathrooms",
  "year_built",
  "lot_size",
  "distance_to_city_center",
  "school_rating",
] as const;

export type MarketField = (typeof marketFields)[number];
export type FeatureDimension = (typeof featureDimensions)[number];
export type SegmentFilters = Partial<
  Record<`min_${MarketField}` | `max_${MarketField}`, number>
>;
