package com.propertyinsights.marketanalysis.export;

import com.propertyinsights.marketanalysis.analysis.DistributionDimension;
import com.propertyinsights.marketanalysis.analysis.DistributionResponse;
import com.propertyinsights.marketanalysis.analysis.MarketAnalysisService;
import com.propertyinsights.marketanalysis.analysis.MarketSummary;
import com.propertyinsights.marketanalysis.analysis.SegmentFilter;
import com.propertyinsights.marketanalysis.error.ApiException;
import com.propertyinsights.marketanalysis.property.PropertyDataset;
import com.propertyinsights.marketanalysis.property.PropertyRecord;
import java.time.Clock;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public final class ExportService {

    private final PropertyDataset dataset;
    private final MarketAnalysisService analysisService;
    private final Clock clock;

    public ExportService(
            PropertyDataset dataset, MarketAnalysisService analysisService, Clock clock) {
        this.dataset = dataset;
        this.analysisService = analysisService;
        this.clock = clock;
    }

    public List<PropertyRecord> properties(SegmentFilter filter) {
        List<PropertyRecord> rows = dataset.all().stream().filter(filter::matches).toList();

        if (rows.isEmpty()) {
            throw noMatchingProperties();
        }

        return rows;
    }

    public ReportData report(SegmentFilter filter) {
        MarketSummary summary = analysisService.summary(filter);

        if (summary.matchedCount() == 0) {
            throw noMatchingProperties();
        }

        Map<DistributionDimension, DistributionResponse> distributions =
                new EnumMap<>(DistributionDimension.class);
        for (DistributionDimension dimension : DistributionDimension.values()) {
            distributions.put(dimension, analysisService.distribution(filter, dimension));
        }

        return new ReportData(filter, summary, distributions, clock.instant());
    }

    private static ApiException noMatchingProperties() {
        return new ApiException(HttpStatus.NOT_FOUND, "No properties match the filters.");
    }
}
