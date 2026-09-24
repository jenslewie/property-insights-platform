package com.propertyinsights.marketanalysis.export;

import static org.assertj.core.api.Assertions.assertThat;

import com.propertyinsights.marketanalysis.analysis.DistributionBucket;
import com.propertyinsights.marketanalysis.analysis.DistributionDimension;
import com.propertyinsights.marketanalysis.analysis.DistributionResponse;
import com.propertyinsights.marketanalysis.analysis.MarketSummary;
import com.propertyinsights.marketanalysis.analysis.SegmentFilter;
import com.propertyinsights.marketanalysis.analysis.SegmentFilterParser;
import com.propertyinsights.marketanalysis.impact.PriceImpactResponse;
import com.propertyinsights.marketanalysis.impact.ScenarioAdjustments;
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

    writer.write(normalReport(), output);
    writeArtifact("market-report.pdf", output);

    try (PDDocument document = Loader.loadPDF(output.toByteArray())) {
      assertThat(document.getNumberOfPages()).isEqualTo(2);
      assertThat(pageText(document, 1))
          .contains(
              "Property Market Analysis",
              "Filters",
              "All properties",
              "MATCHED PROPERTIES",
              "MEAN HISTORICAL PRICE",
              "50 / 50",
              "264,600.00",
              "MEDIAN HISTORICAL PRICE",
              "245,000.00",
              "160,000 - 410,000",
              "Price distribution",
              "< 200,000",
              ">= 350,000",
              "Analysis: 145a21b6",
              "Page 1 of 2")
          .doesNotContain("square_footage", "Living Area", "key=", "range=");
      assertThat(pageText(document, 2))
          .contains(
              "Square footage",
              "Bedrooms",
              "Bathrooms",
              "Year built",
              "Lot size",
              "Distance to city center",
              "School rating",
              "CSV contains the filtered property-level data",
              "Page 2 of 2",
              "n/a");

      assertHeaderGap(document, 1, "Properties", "Average historical price");
      assertHeaderGap(document, 2, "Count", "Avg historical price");

      String text = new PDFTextStripper().getText(document);
      assertThat(text)
          .contains("Properties", "Average historical price", "179,642.86")
          .doesNotContain("average_price=", "Property ID:", "historical_price=");
    }
  }

  @Test
  void paginatesLongDistributionAndWritesTestArtifact() throws Exception {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    writer.write(reportWithManyBuckets(), output);

    writeArtifact("market-report-overflow.pdf", output);

    try (PDDocument document = Loader.loadPDF(output.toByteArray())) {
      assertThat(document.getNumberOfPages()).isEqualTo(6);

      String text = new PDFTextStripper().getText(document);
      assertThat(text).contains("Bathrooms");
      for (int index = 0; index < 80; index++) {
        assertThat(text).contains("Bathroom " + index);
      }

      boolean foundOverflowHeader = false;
      for (int page = 1; page <= document.getNumberOfPages(); page++) {
        String textOnPage = pageText(document, page);
        if (textOnPage.contains("Properties") && textOnPage.contains("Average historical price")) {
          assertHeaderGap(document, page, "Properties", "Average historical price");
          foundOverflowHeader |= page > 2;
        }
      }
      assertThat(foundOverflowHeader).isTrue();
    }
  }

  @Test
  void appendsMarketLevelScenarioPredictionsAfterHistoricalPages() throws Exception {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    writer.write(reportWithScenario(false), output);
    writeArtifact("market-report-scenario.pdf", output);

    try (PDDocument document = Loader.loadPDF(output.toByteArray())) {
      assertThat(document.getNumberOfPages()).isEqualTo(3);
      assertThat(pageText(document, 1)).contains("264,600.00").doesNotContain("255,000.00");
      assertThat(pageText(document, 3))
          .contains(
              "What-if Scenario Analysis",
              "Square footage: +5%",
              "Bedrooms: +1",
              "Bathrooms: +0.5",
              "Year built: +5",
              "Lot size: +500",
              "Distance to city center: +0.5",
              "School rating: +1",
              "Selected properties: 50",
              "Predicted prices (model estimates)",
              "Predicted baseline",
              "Predicted scenario",
              "% change",
              "Mean",
              "Median",
              "Minimum",
              "Maximum",
              "2.00%",
              "Page 3 of 3");
    }
  }

  @Test
  void formatsNegativeScenarioChangesAndMissingPercentages() throws Exception {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    writer.write(reportWithScenario(true), output);

    try (PDDocument document = Loader.loadPDF(output.toByteArray())) {
      assertThat(pageText(document, 3)).contains("-12,500.00", "n/a");
    }
  }

  @Test
  void keepsLongFilterTextWithinThePageAndPreservesItsDigits() throws Exception {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    writer.write(reportWithMaxPrice("1e100"), output);

    try (PDDocument document = Loader.loadPDF(output.toByteArray())) {
      String text = new PDFTextStripper().getText(document);
      assertThat(text.replaceAll("\\s+", "")).contains("Price:Maximum<=1" + "0".repeat(100));

      for (int pageNumber = 1; pageNumber <= document.getNumberOfPages(); pageNumber++) {
        RightEdgeStripper positions = new RightEdgeStripper();
        positions.setStartPage(pageNumber);
        positions.setEndPage(pageNumber);
        positions.getText(document);
        assertThat(positions.rightmost())
            .as("rightmost text character: %s", positions.rightmostText())
            .isLessThanOrEqualTo(564.5f);
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
            .contains("Price: Maximum <= 1E+" + exponent);
      }
    }
  }

  @Test
  void doesNotPrintPropertyLevelSourceRows() throws Exception {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    writer.write(reportWithManyBuckets(), output);

    try (PDDocument document = Loader.loadPDF(output.toByteArray())) {
      String text = new PDFTextStripper().getText(document);

      assertThat(text)
          .contains("CSV contains the filtered property-level data")
          .doesNotContain("Property ID:", "historical_price=", "square_footage=");
    }
  }

  private static String pageText(PDDocument document, int page) throws java.io.IOException {
    PDFTextStripper stripper = new PDFTextStripper();
    stripper.setStartPage(page);
    stripper.setEndPage(page);
    return stripper.getText(document);
  }

  private static void assertHeaderGap(
      PDDocument document, int page, String leftHeader, String rightHeader) throws Exception {
    HeaderGapStripper stripper = new HeaderGapStripper(leftHeader, rightHeader);
    stripper.setStartPage(page);
    stripper.setEndPage(page);
    stripper.getText(document);

    assertThat(stripper.minimumGap())
        .as("gap between '%s' and '%s' on page %s", leftHeader, rightHeader, page)
        .isGreaterThanOrEqualTo(6f);
  }

  private static final class HeaderGapStripper extends PDFTextStripper {
    private final String leftHeader;
    private final String rightHeader;
    private float minimumGap = Float.POSITIVE_INFINITY;

    private HeaderGapStripper(String leftHeader, String rightHeader) throws java.io.IOException {
      this.leftHeader = leftHeader;
      this.rightHeader = rightHeader;
    }

    @Override
    protected void writeString(String text, List<TextPosition> positions) {
      String positionedText =
          positions.stream().map(TextPosition::getUnicode).reduce("", String::concat);
      int leftStart = positionedText.indexOf(leftHeader);
      int rightStart = positionedText.indexOf(rightHeader);
      if (leftStart < 0 || rightStart < 0) {
        return;
      }

      TextPosition leftEnd = positions.get(leftStart + leftHeader.length() - 1);
      TextPosition rightStartPosition = positions.get(rightStart);
      float gap =
          rightStartPosition.getXDirAdj() - (leftEnd.getXDirAdj() + leftEnd.getWidthDirAdj());
      minimumGap = Math.min(minimumGap, gap);
    }

    private float minimumGap() {
      return minimumGap;
    }
  }

  private ReportData normalReport() {
    EnumMap<DistributionDimension, DistributionResponse> distributions =
        new EnumMap<>(DistributionDimension.class);
    distributions.put(
        DistributionDimension.PRICE,
        distribution(
            DistributionDimension.PRICE,
            range("lt_200000", null, "200000", 14, "179642.86"),
            range("200000_to_250000", "200000", "250000", 11, "219090.91"),
            range("250000_to_300000", "250000", "300000", 10, "269500.00"),
            range("300000_to_350000", "300000", "350000", 3, "341666.67"),
            range("gte_350000", "350000", null, 12, "382083.33")));
    distributions.put(
        DistributionDimension.SQUARE_FOOTAGE,
        distribution(
            DistributionDimension.SQUARE_FOOTAGE,
            range("lt_1200", null, "1200", 7, "169285.71"),
            range("1200_to_1600", "1200", "1600", 16, "204687.50"),
            range("1600_to_2000", "1600", "2000", 12, "263333.33"),
            range("gte_2000", "2000", null, 15, "374000.00")));
    distributions.put(
        DistributionDimension.BEDROOMS,
        distribution(
            DistributionDimension.BEDROOMS,
            exact("exact_2", "2", 13, "210000.00"),
            exact("exact_3", "3", 22, "260000.00"),
            exact("exact_4", "4", 15, "340000.00")));
    distributions.put(
        DistributionDimension.BATHROOMS,
        distribution(
            DistributionDimension.BATHROOMS,
            exact("exact_1", "1", 14, "190000.00"),
            exact("exact_1_5", "1.5", 9, "225000.00"),
            exact("exact_2", "2", 12, "260000.00"),
            exact("exact_2_5", "2.5", 8, "310000.00"),
            exact("exact_3", "3", 7, "380000.00")));
    distributions.put(
        DistributionDimension.YEAR_BUILT,
        distribution(
            DistributionDimension.YEAR_BUILT,
            range("lt_1980", null, "1980", 2, "180000.00"),
            range("1980_to_1990", "1980", "1990", 12, "220000.00"),
            range("1990_to_2000", "1990", "2000", 15, "270000.00"),
            range("2000_to_2010", "2000", "2010", 16, "310000.00"),
            range("gte_2010", "2010", null, 5, "370000.00")));
    distributions.put(
        DistributionDimension.LOT_SIZE,
        distribution(
            DistributionDimension.LOT_SIZE,
            range("lt_6000", null, "6000", 14, "210000.00"),
            range("6000_to_8000", "6000", "8000", 19, "260000.00"),
            range("8000_to_10000", "8000", "10000", 12, "310000.00"),
            range("gte_10000", "10000", null, 5, "370000.00")));
    distributions.put(
        DistributionDimension.DISTANCE_TO_CITY_CENTER,
        distribution(
            DistributionDimension.DISTANCE_TO_CITY_CENTER,
            range("lt_3", null, "3", 11, "330000.00"),
            range("3_to_5", "3", "5", 19, "290000.00"),
            range("5_to_7", "5", "7", 10, "250000.00"),
            range("gte_7", "7", null, 10, "210000.00")));
    distributions.put(
        DistributionDimension.SCHOOL_RATING,
        distribution(
            DistributionDimension.SCHOOL_RATING,
            range("lt_7", null, "7", 9, "210000.00"),
            range("7_to_8", "7", "8", 19, "260000.00"),
            range("8_to_9", "8", "9", 17, "310000.00"),
            range("gte_9", "9", null, 5, "370000.00"),
            exact("exact_10", "10", 0, null)));

    MarketSummary summary =
        new MarketSummary(
            50,
            50,
            new MarketSummary.PriceStats(
                new BigDecimal("264600.00"),
                new BigDecimal("245000.00"),
                new BigDecimal("160000.00"),
                new BigDecimal("410000.00")));
    return new ReportData(
        SegmentFilter.unrestricted(),
        summary,
        distributions,
        null,
        null,
        Instant.parse("2026-09-23T00:00:00Z"));
  }

  private static DistributionResponse distribution(
      DistributionDimension dimension, DistributionBucket... buckets) {
    return new DistributionResponse(dimension, 50, List.of(buckets));
  }

  private static DistributionBucket range(
      String key, String minimum, String maximum, int count, String averagePrice) {
    return new DistributionBucket(
        key,
        key,
        minimum == null ? null : new BigDecimal(minimum),
        maximum == null ? null : new BigDecimal(maximum),
        null,
        count,
        averagePrice == null ? null : new BigDecimal(averagePrice));
  }

  private static DistributionBucket exact(
      String key, String value, int count, String averagePrice) {
    return new DistributionBucket(
        key,
        key,
        null,
        null,
        new BigDecimal(value),
        count,
        averagePrice == null ? null : new BigDecimal(averagePrice));
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
        null,
        null,
        Instant.parse("2026-09-23T00:00:00Z"));
  }

  private static final class RightEdgeStripper extends PDFTextStripper {
    private float rightmost;
    private String rightmostText = "";

    private RightEdgeStripper() throws java.io.IOException {}

    @Override
    protected void processTextPosition(TextPosition position) {
      float right = position.getXDirAdj() + position.getWidthDirAdj();
      if (right > rightmost) {
        rightmost = right;
        rightmostText = position.getUnicode();
      }
    }

    private float rightmost() {
      return rightmost;
    }

    private String rightmostText() {
      return rightmostText;
    }
  }

  private ReportData reportWithManyBuckets() {
    var distributions =
        new EnumMap<DistributionDimension, DistributionResponse>(DistributionDimension.class);

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
                null,
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

    return new ReportData(
        filter, summary, distributions, null, null, Instant.parse("2026-09-23T00:00:00Z"));
  }

  private ReportData reportWithScenario(boolean negativeChange) {
    ReportData report = normalReport();
    BigDecimal meanChange = new BigDecimal(negativeChange ? "-12500.00" : "5000.00");
    PriceImpactResponse.PriceMetrics baseline =
        new PriceImpactResponse.PriceMetrics(
            new BigDecimal("250000.00"),
            new BigDecimal("245000.00"),
            new BigDecimal("160000.00"),
            new BigDecimal("410000.00"));
    PriceImpactResponse.PriceMetrics scenario =
        new PriceImpactResponse.PriceMetrics(
            new BigDecimal("255000.00"),
            new BigDecimal("248000.00"),
            new BigDecimal("155000.00"),
            new BigDecimal("430000.00"));
    PriceImpactResponse impact =
        new PriceImpactResponse(
            50,
            baseline,
            scenario,
            new PriceImpactResponse.ImpactMetrics(
                new PriceImpactResponse.MetricImpact(
                    meanChange, negativeChange ? null : new BigDecimal("2.00")),
                new PriceImpactResponse.MetricImpact(
                    new BigDecimal("3000.00"), new BigDecimal("1.22")),
                new PriceImpactResponse.MetricImpact(
                    new BigDecimal("-5000.00"), new BigDecimal("-3.13")),
                new PriceImpactResponse.MetricImpact(
                    new BigDecimal("20000.00"), new BigDecimal("4.88"))));
    return new ReportData(
        report.filter(),
        report.summary(),
        report.distributions(),
        new ScenarioAdjustments(
            new BigDecimal("1"),
            new BigDecimal("5"),
            new BigDecimal("1"),
            new BigDecimal("0.5"),
            new BigDecimal("5"),
            new BigDecimal("500"),
            new BigDecimal("0.5")),
        impact,
        report.generatedAt());
  }

  private static void writeArtifact(String filename, ByteArrayOutputStream output)
      throws java.io.IOException {
    Path artifact = Path.of("target/test-output", filename);
    Files.createDirectories(artifact.getParent());
    Files.write(artifact, output.toByteArray());
  }
}
