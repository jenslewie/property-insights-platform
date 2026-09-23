package com.propertyinsights.marketanalysis.export;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.propertyinsights.marketanalysis.analysis.DistributionDimension;
import com.propertyinsights.marketanalysis.analysis.MarketAnalysisService;
import com.propertyinsights.marketanalysis.analysis.SegmentFilter;
import com.propertyinsights.marketanalysis.analysis.SegmentFilterParser;
import com.propertyinsights.marketanalysis.error.ApiException;
import com.propertyinsights.marketanalysis.property.CsvPropertyLoader;
import com.propertyinsights.marketanalysis.property.PropertyDataset;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.util.LinkedMultiValueMap;

class ExportServiceTest {

    private static final Instant GENERATED_AT = Instant.parse("2026-09-23T00:00:00Z");

    private final PropertyDataset dataset =
            () -> new CsvPropertyLoader().load(Path.of("../data/house-price-dataset.csv"));
    private final ExportService service =
            new ExportService(
                    dataset,
                    new MarketAnalysisService(dataset),
                    Clock.fixed(GENERATED_AT, ZoneOffset.UTC));

    @Test
    void preparesFilteredCsvRowsInSourceOrder() {
        var rows = service.properties(filter("min_price", "350000"));

        assertThat(rows).hasSize(12);
        assertThat(rows)
                .extracting(row -> row.id())
                .containsExactly(7L, 9L, 13L, 15L, 19L, 22L, 26L, 34L, 37L, 39L, 43L, 49L);
    }

    @Test
    void preparesReportWithAllDistributionsAndFixedTimestamp() {
        ReportData report = service.report(filter("min_price", "350000"));

        assertThat(report.summary().matchedCount()).isEqualTo(12);
        assertThat(report.generatedAt()).isEqualTo(GENERATED_AT);
        assertThat(report.distributions()).containsOnlyKeys(DistributionDimension.values());
        assertThat(report.distributions().values())
                .allSatisfy(distribution -> assertThat(distribution.matchedCount()).isEqualTo(12));
    }

    @Test
    void rejectsEmptyExportsBeforePreparingFiles() {
        SegmentFilter filter = filter("min_price", "999999");

        assertThatThrownBy(() -> service.properties(filter))
                .isInstanceOfSatisfying(
                        ApiException.class,
                        problem -> assertThat(problem.status()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> service.report(filter))
                .isInstanceOfSatisfying(
                        ApiException.class,
                        problem -> assertThat(problem.status()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    private static SegmentFilter filter(String name, String value) {
        var params = new LinkedMultiValueMap<String, String>();
        params.add(name, value);
        return new SegmentFilterParser().parse(params);
    }
}
