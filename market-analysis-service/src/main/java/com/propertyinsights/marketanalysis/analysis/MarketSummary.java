package com.propertyinsights.marketanalysis.analysis;

import java.math.BigDecimal;

public record MarketSummary(int totalCount, int matchedCount, PriceStats price) {

    public record PriceStats(
            BigDecimal mean, BigDecimal median, BigDecimal minimum, BigDecimal maximum) {}
}
