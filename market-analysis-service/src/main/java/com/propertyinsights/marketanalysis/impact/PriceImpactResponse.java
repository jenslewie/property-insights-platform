package com.propertyinsights.marketanalysis.impact;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public record PriceImpactResponse(
        HousingFeatures baseline,
        Map<String, FeatureChange> changes,
        BigDecimal baselinePredictedPrice,
        BigDecimal scenarioPredictedPrice,
        BigDecimal absoluteChange,
        BigDecimal percentageChange) {

    public PriceImpactResponse {
        changes = Collections.unmodifiableMap(new LinkedHashMap<>(changes));
    }

    public record FeatureChange(BigDecimal from, BigDecimal to) {}
}
