package com.propertyinsights.marketanalysis.export;

import com.propertyinsights.marketanalysis.analysis.DistributionDimension;
import com.propertyinsights.marketanalysis.analysis.DistributionResponse;
import com.propertyinsights.marketanalysis.analysis.MarketSummary;
import com.propertyinsights.marketanalysis.analysis.SegmentFilter;
import java.time.Instant;
import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;

public record ReportData(
        SegmentFilter filter,
        MarketSummary summary,
        Map<DistributionDimension, DistributionResponse> distributions,
        Instant generatedAt) {
    public ReportData {
        EnumMap<DistributionDimension, DistributionResponse> copy =
                new EnumMap<>(DistributionDimension.class);
        copy.putAll(distributions);
        distributions = Collections.unmodifiableMap(copy);
    }
}
