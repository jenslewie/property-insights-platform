package com.propertyinsights.marketanalysis.analysis;

import java.math.BigDecimal;

public record DistributionBucket(
        String key,
        String label,
        BigDecimal minInclusive,
        BigDecimal maxExclusive,
        BigDecimal exactValue,
        int count,
        BigDecimal averagePrice) {}
