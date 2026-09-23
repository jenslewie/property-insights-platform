package com.propertyinsights.marketanalysis.whatif;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public record WhatIfResponse(
        HousingFeatures baseline,
        Map<String, FeatureChange> changes,
        BigDecimal baselineEstimate,
        BigDecimal scenarioEstimate,
        BigDecimal absoluteChange,
        BigDecimal percentageChange) {

    public WhatIfResponse {
        changes = Collections.unmodifiableMap(new LinkedHashMap<>(changes));
    }

    public record FeatureChange(BigDecimal from, BigDecimal to) {}
}
