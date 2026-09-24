package com.propertyinsights.marketanalysis.impact;

import java.math.BigDecimal;

public record PriceImpactResponse(
        int propertyCount, PriceMetrics baseline, PriceMetrics scenario, ImpactMetrics impact) {

    public record PriceMetrics(
            BigDecimal mean, BigDecimal median, BigDecimal minimum, BigDecimal maximum) {}

    public record ImpactMetrics(
            MetricImpact mean, MetricImpact median, MetricImpact minimum, MetricImpact maximum) {}

    public record MetricImpact(BigDecimal absoluteChange, BigDecimal percentageChange) {}
}
