package com.propertyinsights.marketanalysis.analysis;

import java.util.List;

public record DistributionResponse(
    DistributionDimension dimension, int matchedCount, List<DistributionBucket> buckets) {
  public DistributionResponse {
    buckets = List.copyOf(buckets);
  }
}
