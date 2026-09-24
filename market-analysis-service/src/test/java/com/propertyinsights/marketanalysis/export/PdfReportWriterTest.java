package com.propertyinsights.marketanalysis.export;

import static org.assertj.core.api.Assertions.assertThat;

import com.propertyinsights.marketanalysis.analysis.DistributionBucket;
import com.propertyinsights.marketanalysis.analysis.DistributionDimension;
import com.propertyinsights.marketanalysis.analysis.DistributionResponse;
import com.propertyinsights.marketanalysis.analysis.MarketSummary;
import com.propertyinsights.marketanalysis.analysis.SegmentFilter;
import com.propertyinsights.marketanalysis.analysis.SegmentFilterParser;
import com.propertyinsights.marketanalysis.property.PropertyRecord;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.junit.jupiter.api.Test;
import org.springframework.util.LinkedMultiValueMap;

class PdfReportWriterTest {

    private final PdfReportWriter writer = new PdfReportWriter();

    @Test
    void includesSampleSummaryFiltersAndAllDimensions() throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();

        writer.write(reportWithManyBuckets(), output);

        try (PDDocument document = Loader.loadPDF(output.toByteArray())) {
            String text = new PDFTextStripper().getText(document);

            assertThat(text)
                    .contains(
                            "Property Market Analysis",
                            "Historical metrics describe source prices",
                            "2026-09-23T00:00:00Z",
                            "price: min >= 200000",
                            "Total records: 80",
                            "Matched records: 80",
                            "Mean price: 100000.00",
                            "Filtered source property records",
                            "Property ID: 1",
                            "Property ID: 80",
                            "Bathroom 0",
                            "Bathroom 79");

            for (DistributionDimension dimension : DistributionDimension.values()) {
                assertThat(text).contains(dimension.path());
            }
        }
    }

    @Test
    void paginatesLongDistributionAndWritesTestArtifact() throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        writer.write(reportWithManyBuckets(), output);

        Path artifact = Path.of("target/test-output/market-report.pdf");
        Files.createDirectories(artifact.getParent());
        Files.write(artifact, output.toByteArray());

        try (PDDocument document = Loader.loadPDF(output.toByteArray())) {
            assertThat(document.getNumberOfPages()).isGreaterThan(1);

            String text = new PDFTextStripper().getText(document);
            assertThat(text).contains("Bathroom 0", "Bathroom 79", "school_rating");
        }
    }

    @Test
    void keepsLongFilterTextWithinThePageAndPreservesItsDigits() throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        writer.write(reportWithMaxPrice("1e100"), output);

        try (PDDocument document = Loader.loadPDF(output.toByteArray())) {
            String text = new PDFTextStripper().getText(document);
            assertThat(text.replaceAll("\\s+", "")).contains("price:max<=1" + "0".repeat(100));

            for (int pageNumber = 1; pageNumber <= document.getNumberOfPages(); pageNumber++) {
                RightEdgeStripper positions = new RightEdgeStripper();
                positions.setStartPage(pageNumber);
                positions.setEndPage(pageNumber);
                positions.getText(document);
                assertThat(positions.rightmost()).isLessThanOrEqualTo(564.5f);
            }
        }
    }

    @Test
    void usesCompactNotationForExtremeFilterExponent() throws Exception {
        for (String exponent : List.of("1000", "1000000")) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            writer.write(reportWithMaxPrice("1e" + exponent), output);

            assertThat(output.size()).isLessThan(10_000);
            try (PDDocument document = Loader.loadPDF(output.toByteArray())) {
                assertThat(new PDFTextStripper().getText(document))
                        .contains("price: max <= 1E+" + exponent);
            }
        }
    }

    @Test
    void wrapsPropertyRowsAtWordBoundaries() throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        writer.write(reportWithManyBuckets(), output);

        try (PDDocument document = Loader.loadPDF(output.toByteArray())) {
            String text = new PDFTextStripper().getText(document);

            assertThat(text).contains("historical_price=100000.00");
        }
    }

    private ReportData reportWithMaxPrice(String maxPrice) {
        LinkedMultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("max_price", maxPrice);
        SegmentFilter filter = new SegmentFilterParser().parse(params);
        MarketSummary summary =
                new MarketSummary(0, 0, new MarketSummary.PriceStats(null, null, null, null));
        return new ReportData(
                filter,
                summary,
                new EnumMap<>(DistributionDimension.class),
                List.of(),
                null,
                null,
                Instant.parse("2026-09-23T00:00:00Z"));
    }

    private static final class RightEdgeStripper extends PDFTextStripper {
        private float rightmost;

        private RightEdgeStripper() throws java.io.IOException {}

        @Override
        protected void processTextPosition(TextPosition position) {
            rightmost = Math.max(rightmost, position.getXDirAdj() + position.getWidthDirAdj());
        }

        private float rightmost() {
            return rightmost;
        }
    }

    private ReportData reportWithManyBuckets() {
        var distributions =
                new EnumMap<DistributionDimension, DistributionResponse>(
                        DistributionDimension.class);

        for (DistributionDimension dimension : DistributionDimension.values()) {
            int bucketCount = dimension == DistributionDimension.BATHROOMS ? 80 : 1;
            List<DistributionBucket> buckets = new ArrayList<>();

            for (int index = 0; index < bucketCount; index++) {
                String label =
                        dimension == DistributionDimension.BATHROOMS
                                ? "Bathroom " + index
                                : dimension.path() + " sample";

                buckets.add(
                        new DistributionBucket(
                                dimension.path() + "_" + index,
                                label,
                                null,
                                null,
                                BigDecimal.valueOf(index),
                                1,
                                new BigDecimal("100000.00")));
            }

            distributions.put(dimension, new DistributionResponse(dimension, 80, buckets));
        }

        MarketSummary summary =
                new MarketSummary(
                        80,
                        80,
                        new MarketSummary.PriceStats(
                                new BigDecimal("100000.00"),
                                new BigDecimal("100000.00"),
                                new BigDecimal("100000.00"),
                                new BigDecimal("100000.00")));

        LinkedMultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("min_price", "200000");
        SegmentFilter filter = new SegmentFilterParser().parse(params);

        List<PropertyRecord> properties =
                java.util.stream.IntStream.rangeClosed(1, 80)
                        .mapToObj(
                                id ->
                                        new PropertyRecord(
                                                id,
                                                1000 + id,
                                                3,
                                                new BigDecimal("2.0"),
                                                2000,
                                                6000 + id,
                                                new BigDecimal("4.0"),
                                                new BigDecimal("8.0"),
                                                new BigDecimal("100000.00")))
                        .toList();
        return new ReportData(
                filter,
                summary,
                distributions,
                properties,
                null,
                null,
                Instant.parse("2026-09-23T00:00:00Z"));
    }
}
