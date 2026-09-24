package com.propertyinsights.marketanalysis.export;

import com.propertyinsights.marketanalysis.analysis.DistributionBucket;
import com.propertyinsights.marketanalysis.analysis.DistributionDimension;
import com.propertyinsights.marketanalysis.analysis.DistributionResponse;
import com.propertyinsights.marketanalysis.analysis.MarketSummary;
import com.propertyinsights.marketanalysis.analysis.SegmentFilter;
import com.propertyinsights.marketanalysis.impact.PriceImpactResponse;
import com.propertyinsights.marketanalysis.impact.ScenarioAdjustments;
import java.awt.Color;
import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Component;

@Component
public final class PdfReportWriter {

  private static final String TITLE = "Property Market Analysis";
  private static final float MARGIN = 42f;
  private static final float PAGE_WIDTH = PDRectangle.LETTER.getWidth();
  private static final float PAGE_HEIGHT = PDRectangle.LETTER.getHeight();
  private static final float CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
  private static final float FOOTER_LIMIT = 52f;
  private static final int MAX_COMPACT_BUCKETS = 5;
  private static final int OVERFLOW_ROWS_PER_PAGE = 24;
  private static final float FEATURE_GAP = 16f;
  private static final float FEATURE_WIDTH = (CONTENT_WIDTH - FEATURE_GAP) / 2f;

  private static final int TEXT_R = 15;
  private static final int TEXT_G = 23;
  private static final int TEXT_B = 42;
  private static final int MUTED_R = 71;
  private static final int MUTED_G = 85;
  private static final int MUTED_B = 105;
  private static final int BORDER_R = 215;
  private static final int BORDER_G = 223;
  private static final int BORDER_B = 234;
  private static final int CARD_R = 250;
  private static final int CARD_G = 251;
  private static final int CARD_B = 253;
  private static final int ACCENT_R = 37;
  private static final int ACCENT_G = 99;
  private static final int ACCENT_B = 235;
  private static final int BAR_BACKGROUND_R = 229;
  private static final int BAR_BACKGROUND_G = 234;
  private static final int BAR_BACKGROUND_B = 241;

  public void write(ReportData report, OutputStream output) throws IOException {
    try (PDDocument document = new PDDocument()) {
      List<PDPage> pages;
      try (PdfLayout layout = new PdfLayout(document)) {
        drawOverview(layout, report);
        drawFeaturePage(
            layout,
            report,
            "Property characteristics",
            List.of(
                DistributionDimension.SQUARE_FOOTAGE,
                DistributionDimension.BEDROOMS,
                DistributionDimension.BATHROOMS,
                DistributionDimension.YEAR_BUILT,
                DistributionDimension.LOT_SIZE,
                DistributionDimension.DISTANCE_TO_CITY_CENTER,
                DistributionDimension.SCHOOL_RATING));
        drawOverflowCharts(layout, report);
        drawScenarioPage(layout, report);
        pages = List.copyOf(layout.pages());
      }

      drawFooters(document, pages, report);
      document.save(output);
    }
  }

  private static void drawOverview(PdfLayout layout, ReportData report) throws IOException {
    layout.startSectionPage(
        TITLE, "Historical source-price analysis for the selected property segment.");
    drawFilters(layout, report.filter());
    drawKpis(layout, report.summary());
    drawPriceDistribution(layout, report.distributions().get(DistributionDimension.PRICE));
  }

  private static void drawFilters(PdfLayout layout, SegmentFilter filter) throws IOException {
    List<String> lines = new ArrayList<>();
    Map<String, SegmentFilter.Bounds> bounds = filter.activeBounds();
    if (bounds.isEmpty()) {
      lines.add("All properties");
    } else {
      for (Map.Entry<String, SegmentFilter.Bounds> entry : bounds.entrySet()) {
        SegmentFilter.Bounds value = entry.getValue();
        StringBuilder line = new StringBuilder(fieldLabel(entry.getKey())).append(": ");
        if (value.min() != null) {
          line.append("Minimum >= ").append(filterValue(value.min()));
        }
        if (value.min() != null && value.max() != null) {
          line.append(", ");
        }
        if (value.max() != null) {
          line.append("Maximum <= ").append(filterValue(value.max()));
        }
        lines.add(line.toString());
      }
    }

    List<String> wrapped = new ArrayList<>();
    for (String line : lines) {
      wrapped.addAll(wrapText(line, layout.bodyFont(), 9f, CONTENT_WIDTH - 24));
    }

    float height = 34f + wrapped.size() * 12f;
    layout.ensureSpace(height + 14f);
    float top = layout.y();
    drawCard(layout.stream(), MARGIN, top, CONTENT_WIDTH, height);
    drawText(
        layout.stream(),
        layout.boldFont(),
        10f,
        MARGIN + 12,
        top - 17,
        "Filters",
        TEXT_R,
        TEXT_G,
        TEXT_B);
    float y = top - 32;
    for (String line : wrapped) {
      drawText(
          layout.stream(), layout.bodyFont(), 9f, MARGIN + 12, y, line, MUTED_R, MUTED_G, MUTED_B);
      y -= 12f;
    }
    layout.setY(top - height - 14f);
  }

  private static void drawKpis(PdfLayout layout, MarketSummary summary) throws IOException {
    layout.ensureSpace(78f);
    MarketSummary.PriceStats price = summary.price();
    float gap = 8f;
    float width = (CONTENT_WIDTH - 3 * gap) / 4f;
    float top = layout.y();
    drawKpi(
        layout,
        MARGIN,
        top,
        width,
        "MATCHED PROPERTIES",
        summary.matchedCount() + " / " + summary.totalCount());
    drawKpi(layout, MARGIN + width + gap, top, width, "MEAN HISTORICAL PRICE", money(price.mean()));
    drawKpi(
        layout,
        MARGIN + 2 * (width + gap),
        top,
        width,
        "MEDIAN HISTORICAL PRICE",
        money(price.median()));
    String priceRange =
        price.minimum() == null || price.maximum() == null
            ? "n/a"
            : number(price.minimum()) + " - " + number(price.maximum());
    drawKpi(layout, MARGIN + 3 * (width + gap), top, width, "PRICE RANGE", priceRange);
    layout.setY(top - 70f - 18f);
  }

  private static void drawKpi(
      PdfLayout layout, float x, float top, float width, String label, String value)
      throws IOException {
    drawCard(layout.stream(), x, top, width, 70f);
    drawText(
        layout.stream(),
        layout.boldFont(),
        7.1f,
        x + 10,
        top - 19,
        label,
        MUTED_R,
        MUTED_G,
        MUTED_B);
    drawFittedText(
        layout.stream(),
        layout.boldFont(),
        12f,
        8.5f,
        x + 10,
        top - 46,
        value,
        width - 20,
        TEXT_R,
        TEXT_G,
        TEXT_B);
  }

  private static void drawPriceDistribution(PdfLayout layout, DistributionResponse response)
      throws IOException {
    List<DistributionBucket> buckets = response == null ? List.of() : response.buckets();
    float rowHeight = 25f;
    float height = 47f + rowHeight * Math.max(1, buckets.size());
    layout.ensureSpace(height + 4f);
    float top = layout.y();
    drawCard(layout.stream(), MARGIN, top, CONTENT_WIDTH, height);
    drawText(
        layout.stream(),
        layout.boldFont(),
        12f,
        MARGIN + 12,
        top - 20,
        "Price distribution",
        TEXT_R,
        TEXT_G,
        TEXT_B);
    float headerY = top - 37;
    drawText(
        layout.stream(),
        layout.boldFont(),
        8f,
        MARGIN + 12,
        headerY,
        "Bucket",
        MUTED_R,
        MUTED_G,
        MUTED_B);
    drawText(
        layout.stream(),
        layout.boldFont(),
        8f,
        MARGIN + 383,
        headerY,
        "Properties",
        MUTED_R,
        MUTED_G,
        MUTED_B);
    drawText(
        layout.stream(),
        layout.boldFont(),
        7.2f,
        MARGIN + 432,
        headerY,
        "Average historical price",
        MUTED_R,
        MUTED_G,
        MUTED_B);

    if (buckets.isEmpty()) {
      drawText(
          layout.stream(),
          layout.bodyFont(),
          9f,
          MARGIN + 12,
          top - 58,
          "No price distribution data",
          MUTED_R,
          MUTED_G,
          MUTED_B);
    } else {
      int maximumCount = maximumCount(buckets);
      for (int i = 0; i < buckets.size(); i++) {
        drawWideBucketRow(
            layout.stream(),
            layout.bodyFont(),
            buckets.get(i),
            maximumCount,
            MARGIN,
            top - 48 - i * rowHeight,
            DistributionDimension.PRICE);
      }
    }
    layout.setY(top - height - 4f);
  }

  private static void drawFeaturePage(
      PdfLayout layout, ReportData report, String title, List<DistributionDimension> dimensions)
      throws IOException {
    layout.startSectionPage(
        title, "Properties by feature value and average historical price in each bucket.");
    int rows = (dimensions.size() + 1) / 2;
    for (int row = 0; row < rows; row++) {
      DistributionDimension left = dimensions.get(row * 2);
      DistributionDimension right =
          row * 2 + 1 < dimensions.size() ? dimensions.get(row * 2 + 1) : null;
      DistributionResponse leftResponse = report.distributions().get(left);
      DistributionResponse rightResponse = right == null ? null : report.distributions().get(right);
      float rowHeight =
          Math.max(featurePanelHeight(leftResponse), featurePanelHeight(rightResponse));
      layout.ensureSpace(rowHeight + 14f);
      float top = layout.y();
      drawFeaturePanel(layout, left, leftResponse, MARGIN, top, FEATURE_WIDTH, rowHeight);
      if (right != null) {
        drawFeaturePanel(
            layout,
            right,
            rightResponse,
            MARGIN + FEATURE_WIDTH + FEATURE_GAP,
            top,
            FEATURE_WIDTH,
            rowHeight);
      }
      layout.setY(top - rowHeight - 14f);
    }
    drawCsvNote(layout);
  }

  private static float featurePanelHeight(DistributionResponse response) {
    int count = response == null ? 0 : response.buckets().size();
    if (count > MAX_COMPACT_BUCKETS) {
      return 78f;
    }
    return 50f + 18f * Math.max(1, count);
  }

  private static void drawFeaturePanel(
      PdfLayout layout,
      DistributionDimension dimension,
      DistributionResponse response,
      float x,
      float top,
      float width,
      float height)
      throws IOException {
    drawCard(layout.stream(), x, top, width, height);
    drawText(
        layout.stream(),
        layout.boldFont(),
        11f,
        x + 10,
        top - 17,
        dimensionLabel(dimension),
        TEXT_R,
        TEXT_G,
        TEXT_B);

    if (response == null || response.buckets().isEmpty()) {
      drawText(
          layout.stream(),
          layout.bodyFont(),
          9f,
          x + 10,
          top - 40,
          "No distribution data",
          MUTED_R,
          MUTED_G,
          MUTED_B);
      return;
    }

    List<DistributionBucket> buckets = response.buckets();
    if (buckets.size() > MAX_COMPACT_BUCKETS) {
      drawText(
          layout.stream(),
          layout.bodyFont(),
          9f,
          x + 10,
          top - 43,
          buckets.size() + " buckets continue on detail pages.",
          MUTED_R,
          MUTED_G,
          MUTED_B);
      return;
    }

    float headerY = top - 34;
    drawText(
        layout.stream(),
        layout.boldFont(),
        7.2f,
        x + 10,
        headerY,
        "Bucket",
        MUTED_R,
        MUTED_G,
        MUTED_B);
    drawText(
        layout.stream(),
        layout.boldFont(),
        7.2f,
        x + 148,
        headerY,
        "Count",
        MUTED_R,
        MUTED_G,
        MUTED_B);
    drawText(
        layout.stream(),
        layout.boldFont(),
        7.2f,
        x + 180,
        headerY,
        "Avg historical price",
        MUTED_R,
        MUTED_G,
        MUTED_B);

    int maximumCount = maximumCount(buckets);
    for (int i = 0; i < buckets.size(); i++) {
      drawCompactBucketRow(
          layout.stream(),
          layout.bodyFont(),
          buckets.get(i),
          maximumCount,
          x,
          top - 50 - i * 18f,
          dimension);
    }
  }

  private static void drawCsvNote(PdfLayout layout) throws IOException {
    layout.ensureSpace(34f);
    drawText(
        layout.stream(),
        layout.bodyFont(),
        8.5f,
        MARGIN,
        layout.y() - 1,
        "CSV contains the filtered property-level data.",
        MUTED_R,
        MUTED_G,
        MUTED_B);
    layout.setY(layout.y() - 22f);
  }

  private static void drawScenarioPage(PdfLayout layout, ReportData report) throws IOException {
    if (report.scenario() == null || report.priceImpact() == null) {
      return;
    }

    layout.startSectionPage(
        "What-if Scenario Analysis",
        "Model-predicted aggregate prices for the selected property segment.");
    drawScenarioContext(layout, report.scenario(), report.priceImpact().propertyCount());
    drawScenarioTable(layout, report.priceImpact());
  }

  private static void drawScenarioContext(
      PdfLayout layout, ScenarioAdjustments scenario, int propertyCount) throws IOException {
    List<String> adjustments = new ArrayList<>();
    if (scenario.squareFootagePercent() != null
        && scenario.squareFootagePercent().compareTo(BigDecimal.ZERO) != 0) {
      adjustments.add("Square footage: " + signedNumber(scenario.squareFootagePercent()) + "%");
    }
    if (scenario.bedroomsDelta() != null
        && scenario.bedroomsDelta().compareTo(BigDecimal.ZERO) != 0) {
      adjustments.add("Bedrooms: " + signedNumber(scenario.bedroomsDelta()));
    }
    if (scenario.bathroomsDelta() != null
        && scenario.bathroomsDelta().compareTo(BigDecimal.ZERO) != 0) {
      adjustments.add("Bathrooms: " + signedNumber(scenario.bathroomsDelta()));
    }
    if (scenario.yearBuiltDelta() != null
        && scenario.yearBuiltDelta().compareTo(BigDecimal.ZERO) != 0) {
      adjustments.add("Year built: " + signedNumber(scenario.yearBuiltDelta()));
    }
    if (scenario.lotSizeDelta() != null
        && scenario.lotSizeDelta().compareTo(BigDecimal.ZERO) != 0) {
      adjustments.add("Lot size: " + signedNumber(scenario.lotSizeDelta()));
    }
    if (scenario.distanceToCityCenterDelta() != null
        && scenario.distanceToCityCenterDelta().compareTo(BigDecimal.ZERO) != 0) {
      adjustments.add(
          "Distance to city center: " + signedNumber(scenario.distanceToCityCenterDelta()));
    }
    if (scenario.schoolRatingDelta() != null
        && scenario.schoolRatingDelta().compareTo(BigDecimal.ZERO) != 0) {
      adjustments.add("School rating: " + signedNumber(scenario.schoolRatingDelta()));
    }

    List<String> adjustmentLines =
        wrapText(
            adjustments.isEmpty() ? "No adjustments specified" : String.join("  |  ", adjustments),
            layout.bodyFont(),
            9f,
            CONTENT_WIDTH - 24);
    float height = 37f + adjustmentLines.size() * 12f;
    layout.ensureSpace(height + 14f);
    float top = layout.y();
    drawCard(layout.stream(), MARGIN, top, CONTENT_WIDTH, height);
    drawText(
        layout.stream(),
        layout.boldFont(),
        9f,
        MARGIN + 12,
        top - 18,
        "Selected properties: " + propertyCount,
        TEXT_R,
        TEXT_G,
        TEXT_B);
    drawText(
        layout.stream(),
        layout.bodyFont(),
        9f,
        MARGIN + 12,
        top - 35,
        adjustmentLines.get(0),
        MUTED_R,
        MUTED_G,
        MUTED_B);
    for (int index = 1; index < adjustmentLines.size(); index++) {
      drawText(
          layout.stream(),
          layout.bodyFont(),
          9f,
          MARGIN + 12,
          top - 35f - index * 12f,
          adjustmentLines.get(index),
          MUTED_R,
          MUTED_G,
          MUTED_B);
    }
    layout.setY(top - height - 14f);
  }

  private static void drawScenarioTable(PdfLayout layout, PriceImpactResponse impact)
      throws IOException {
    float top = layout.y();
    float rowHeight = 27f;
    float height = 48f + rowHeight * 4;
    layout.ensureSpace(height + 8f);
    top = layout.y();
    drawCard(layout.stream(), MARGIN, top, CONTENT_WIDTH, height);
    drawText(
        layout.stream(),
        layout.boldFont(),
        10f,
        MARGIN + 12,
        top - 19,
        "Predicted prices (model estimates)",
        TEXT_R,
        TEXT_G,
        TEXT_B);

    float headerY = top - 37;
    drawText(
        layout.stream(),
        layout.boldFont(),
        8f,
        MARGIN + 12,
        headerY,
        "Measure",
        MUTED_R,
        MUTED_G,
        MUTED_B);
    drawText(
        layout.stream(),
        layout.boldFont(),
        8f,
        MARGIN + 91,
        headerY,
        "Predicted baseline",
        MUTED_R,
        MUTED_G,
        MUTED_B);
    drawText(
        layout.stream(),
        layout.boldFont(),
        8f,
        MARGIN + 199,
        headerY,
        "Predicted scenario",
        MUTED_R,
        MUTED_G,
        MUTED_B);
    drawText(
        layout.stream(),
        layout.boldFont(),
        8f,
        MARGIN + 316,
        headerY,
        "Change",
        MUTED_R,
        MUTED_G,
        MUTED_B);
    drawText(
        layout.stream(),
        layout.boldFont(),
        8f,
        MARGIN + 407,
        headerY,
        "% change",
        MUTED_R,
        MUTED_G,
        MUTED_B);

    drawScenarioMetric(
        layout.stream(),
        "Mean",
        impact.baseline().mean(),
        impact.scenario().mean(),
        impact.impact().mean(),
        headerY - 19);
    drawScenarioMetric(
        layout.stream(),
        "Median",
        impact.baseline().median(),
        impact.scenario().median(),
        impact.impact().median(),
        headerY - 19 - rowHeight);
    drawScenarioMetric(
        layout.stream(),
        "Minimum",
        impact.baseline().minimum(),
        impact.scenario().minimum(),
        impact.impact().minimum(),
        headerY - 19 - 2 * rowHeight);
    drawScenarioMetric(
        layout.stream(),
        "Maximum",
        impact.baseline().maximum(),
        impact.scenario().maximum(),
        impact.impact().maximum(),
        headerY - 19 - 3 * rowHeight);
    layout.setY(top - height - 8f);
  }

  private static void drawScenarioMetric(
      PDPageContentStream stream,
      String label,
      BigDecimal baseline,
      BigDecimal scenario,
      PriceImpactResponse.MetricImpact change,
      float y)
      throws IOException {
    drawText(
        stream,
        new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD),
        9f,
        MARGIN + 12,
        y,
        label,
        TEXT_R,
        TEXT_G,
        TEXT_B);
    drawText(
        stream,
        new PDType1Font(Standard14Fonts.FontName.HELVETICA),
        9f,
        MARGIN + 91,
        y,
        money(baseline),
        TEXT_R,
        TEXT_G,
        TEXT_B);
    drawText(
        stream,
        new PDType1Font(Standard14Fonts.FontName.HELVETICA),
        9f,
        MARGIN + 199,
        y,
        money(scenario),
        TEXT_R,
        TEXT_G,
        TEXT_B);
    drawText(
        stream,
        new PDType1Font(Standard14Fonts.FontName.HELVETICA),
        9f,
        MARGIN + 316,
        y,
        change == null ? "n/a" : money(change.absoluteChange()),
        TEXT_R,
        TEXT_G,
        TEXT_B);
    drawText(
        stream,
        new PDType1Font(Standard14Fonts.FontName.HELVETICA),
        9f,
        MARGIN + 407,
        y,
        change == null ? "n/a" : percentage(change.percentageChange()),
        TEXT_R,
        TEXT_G,
        TEXT_B);
  }

  private static void drawOverflowCharts(PdfLayout layout, ReportData report) throws IOException {
    for (DistributionDimension dimension :
        List.of(
            DistributionDimension.SQUARE_FOOTAGE,
            DistributionDimension.BEDROOMS,
            DistributionDimension.BATHROOMS,
            DistributionDimension.YEAR_BUILT,
            DistributionDimension.LOT_SIZE,
            DistributionDimension.DISTANCE_TO_CITY_CENTER,
            DistributionDimension.SCHOOL_RATING)) {
      DistributionResponse response = report.distributions().get(dimension);
      if (response == null || response.buckets().size() <= MAX_COMPACT_BUCKETS) {
        continue;
      }
      List<DistributionBucket> buckets = response.buckets();
      int maximumCount = maximumCount(buckets);
      for (int start = 0; start < buckets.size(); start += OVERFLOW_ROWS_PER_PAGE) {
        int end = Math.min(start + OVERFLOW_ROWS_PER_PAGE, buckets.size());
        String title =
            dimensionLabel(dimension)
                + " distribution"
                + (start == 0 ? " - detail" : " (continued)");
        layout.startSectionPage(
            title,
            "Property counts and average historical price by "
                + dimensionLabel(dimension).toLowerCase(Locale.ROOT)
                + " bucket.");
        float headerY = layout.y();
        drawWideTableHeader(layout.stream(), layout.boldFont(), headerY);
        float rowY = headerY - 22f;
        for (int i = start; i < end; i++) {
          drawWideBucketRow(
              layout.stream(),
              layout.bodyFont(),
              buckets.get(i),
              maximumCount,
              MARGIN,
              rowY,
              dimension);
          rowY -= 24f;
        }
        layout.setY(rowY - 8f);
      }
    }
  }

  private static void drawWideTableHeader(PDPageContentStream stream, PDFont font, float y)
      throws IOException {
    drawText(stream, font, 8f, MARGIN + 12, y, "Bucket", MUTED_R, MUTED_G, MUTED_B);
    drawText(stream, font, 8f, MARGIN + 383, y, "Properties", MUTED_R, MUTED_G, MUTED_B);
    drawText(
        stream, font, 7.2f, MARGIN + 432, y, "Average historical price", MUTED_R, MUTED_G, MUTED_B);
  }

  private static void drawWideBucketRow(
      PDPageContentStream stream,
      PDFont font,
      DistributionBucket bucket,
      int maximumCount,
      float x,
      float baseline,
      DistributionDimension dimension)
      throws IOException {
    String label = bucketLabel(bucket, dimension);
    drawFittedText(stream, font, 9f, 8f, x + 12, baseline, label, 110f, MUTED_R, MUTED_G, MUTED_B);

    float barX = x + 130f;
    float barWidth = 232f;
    drawBar(stream, barX, baseline - 8f, barWidth, 8f, bucket.count(), maximumCount);
    drawText(
        stream,
        font,
        9f,
        x + 383,
        baseline,
        Integer.toString(bucket.count()),
        TEXT_R,
        TEXT_G,
        TEXT_B);
    drawText(
        stream, font, 9f, x + 432, baseline, money(bucket.averagePrice()), TEXT_R, TEXT_G, TEXT_B);
  }

  private static void drawCompactBucketRow(
      PDPageContentStream stream,
      PDFont font,
      DistributionBucket bucket,
      int maximumCount,
      float x,
      float baseline,
      DistributionDimension dimension)
      throws IOException {
    drawFittedText(
        stream,
        font,
        9f,
        8f,
        x + 10,
        baseline,
        bucketLabel(bucket, dimension),
        75f,
        MUTED_R,
        MUTED_G,
        MUTED_B);
    drawBar(stream, x + 88, baseline - 7f, 54f, 6f, bucket.count(), maximumCount);
    drawText(
        stream,
        font,
        9f,
        x + 148,
        baseline,
        Integer.toString(bucket.count()),
        TEXT_R,
        TEXT_G,
        TEXT_B);
    drawFittedText(
        stream,
        font,
        9f,
        8f,
        x + 180,
        baseline,
        money(bucket.averagePrice()),
        64f,
        TEXT_R,
        TEXT_G,
        TEXT_B);
  }

  private static void drawBar(
      PDPageContentStream stream,
      float x,
      float y,
      float maximumWidth,
      float height,
      int count,
      int maximumCount)
      throws IOException {
    stream.setNonStrokingColor(new Color(BAR_BACKGROUND_R, BAR_BACKGROUND_G, BAR_BACKGROUND_B));
    stream.addRect(x, y, maximumWidth, height);
    stream.fill();
    float filledWidth = maximumCount == 0 ? 0f : maximumWidth * count / (float) maximumCount;
    if (filledWidth > 0f) {
      stream.setNonStrokingColor(new Color(ACCENT_R, ACCENT_G, ACCENT_B));
      stream.addRect(x, y, filledWidth, height);
      stream.fill();
    }
  }

  private static void drawCard(
      PDPageContentStream stream, float x, float top, float width, float height)
      throws IOException {
    stream.setNonStrokingColor(new Color(CARD_R, CARD_G, CARD_B));
    stream.addRect(x, top - height, width, height);
    stream.fill();
    stream.setStrokingColor(new Color(BORDER_R, BORDER_G, BORDER_B));
    stream.setLineWidth(0.7f);
    stream.addRect(x, top - height, width, height);
    stream.stroke();
  }

  private static void drawFooters(PDDocument document, List<PDPage> pages, ReportData report)
      throws IOException {
    String key = AnalysisKey.from(report.filter(), report.scenario());
    String exportedAt = report.generatedAt().toString();
    for (int i = 0; i < pages.size(); i++) {
      PDPageContentStream stream =
          new PDPageContentStream(
              document, pages.get(i), PDPageContentStream.AppendMode.APPEND, true, true);
      try (stream) {
        stream.setStrokingColor(new Color(BORDER_R, BORDER_G, BORDER_B));
        stream.setLineWidth(0.6f);
        stream.moveTo(MARGIN, 39f);
        stream.lineTo(PAGE_WIDTH - MARGIN, 39f);
        stream.stroke();
        drawText(
            stream,
            new PDType1Font(Standard14Fonts.FontName.HELVETICA),
            7f,
            MARGIN,
            25f,
            "Analysis: " + key,
            MUTED_R,
            MUTED_G,
            MUTED_B);
        drawText(
            stream,
            new PDType1Font(Standard14Fonts.FontName.HELVETICA),
            7f,
            175f,
            25f,
            "Exported at (UTC): " + exportedAt,
            MUTED_R,
            MUTED_G,
            MUTED_B);
        String pageNumber = "Page " + (i + 1) + " of " + pages.size();
        PDFont font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
        float pageNumberX = PAGE_WIDTH - MARGIN - 7f - textWidth(font, 7f, pageNumber);
        drawText(stream, font, 7f, pageNumberX, 25f, pageNumber, MUTED_R, MUTED_G, MUTED_B);
      }
    }
  }

  private static void drawText(
      PDPageContentStream stream,
      PDFont font,
      float fontSize,
      float x,
      float y,
      String text,
      int red,
      int green,
      int blue)
      throws IOException {
    stream.beginText();
    stream.setFont(font, fontSize);
    stream.setNonStrokingColor(new Color(red, green, blue));
    stream.newLineAtOffset(x, y);
    stream.showText(text);
    stream.endText();
  }

  private static void drawFittedText(
      PDPageContentStream stream,
      PDFont font,
      float preferredSize,
      float minimumSize,
      float x,
      float y,
      String text,
      float maxWidth,
      int red,
      int green,
      int blue)
      throws IOException {
    float size = preferredSize;
    while (size > minimumSize && textWidth(font, size, text) > maxWidth) {
      size -= 0.25f;
    }
    drawText(stream, font, Math.max(size, minimumSize), x, y, text, red, green, blue);
  }

  private static List<String> wrapText(String text, PDFont font, float size, float maxWidth)
      throws IOException {
    List<String> lines = new ArrayList<>();
    String remaining = text;
    while (!remaining.isEmpty()) {
      if (textWidth(font, size, remaining) <= maxWidth) {
        lines.add(remaining);
        break;
      }
      int cut = remaining.length();
      while (cut > 1 && textWidth(font, size, remaining.substring(0, cut)) > maxWidth) {
        cut--;
      }
      int space = remaining.lastIndexOf(' ', cut);
      if (space > 0) {
        lines.add(remaining.substring(0, space));
        remaining = remaining.substring(space + 1);
      } else {
        lines.add(remaining.substring(0, cut));
        remaining = remaining.substring(cut);
      }
    }
    return lines;
  }

  private static float textWidth(PDFont font, float size, String text) throws IOException {
    return font.getStringWidth(text) * size / 1000f;
  }

  private static int maximumCount(List<DistributionBucket> buckets) {
    return buckets.stream().mapToInt(DistributionBucket::count).max().orElse(0);
  }

  private static String bucketLabel(DistributionBucket bucket, DistributionDimension dimension) {
    if (bucket.exactValue() != null) {
      return dimensionNumber(bucket.exactValue(), dimension);
    }
    if (bucket.minInclusive() == null && bucket.maxExclusive() != null) {
      return "< " + dimensionNumber(bucket.maxExclusive(), dimension);
    }
    if (bucket.minInclusive() != null && bucket.maxExclusive() == null) {
      return ">= " + dimensionNumber(bucket.minInclusive(), dimension);
    }
    if (bucket.minInclusive() != null && bucket.maxExclusive() != null) {
      return dimensionNumber(bucket.minInclusive(), dimension)
          + " - < "
          + dimensionNumber(bucket.maxExclusive(), dimension);
    }
    return bucket.label() == null || bucket.label().isBlank() ? "Unspecified" : bucket.label();
  }

  private static String dimensionNumber(BigDecimal value, DistributionDimension dimension) {
    return dimension == DistributionDimension.YEAR_BUILT
        ? value.stripTrailingZeros().toPlainString()
        : number(value);
  }

  private static String dimensionLabel(DistributionDimension dimension) {
    return switch (dimension) {
      case PRICE -> "Price";
      case SQUARE_FOOTAGE -> "Square footage";
      case BEDROOMS -> "Bedrooms";
      case BATHROOMS -> "Bathrooms";
      case YEAR_BUILT -> "Year built";
      case LOT_SIZE -> "Lot size";
      case DISTANCE_TO_CITY_CENTER -> "Distance to city center";
      case SCHOOL_RATING -> "School rating";
    };
  }

  private static String fieldLabel(String field) {
    return switch (field) {
      case "square_footage" -> "Square footage";
      case "bedrooms" -> "Bedrooms";
      case "bathrooms" -> "Bathrooms";
      case "year_built" -> "Year built";
      case "lot_size" -> "Lot size";
      case "distance_to_city_center" -> "Distance to city center";
      case "school_rating" -> "School rating";
      case "price" -> "Price";
      default -> field;
    };
  }

  private static String filterValue(BigDecimal value) {
    long maximumPlainLength = (long) value.precision() + Math.abs((long) value.scale()) + 2;
    return maximumPlainLength > 512 ? value.toString() : value.toPlainString();
  }

  private static String number(BigDecimal value) {
    DecimalFormat format =
        new DecimalFormat("#,##0.##", DecimalFormatSymbols.getInstance(Locale.US));
    format.setRoundingMode(RoundingMode.HALF_UP);
    return format.format(value);
  }

  private static String signedNumber(BigDecimal value) {
    return (value.compareTo(BigDecimal.ZERO) > 0 ? "+" : "") + number(value);
  }

  private static String percentage(BigDecimal value) {
    if (value == null) {
      return "n/a";
    }
    DecimalFormat format =
        new DecimalFormat("#,##0.00", DecimalFormatSymbols.getInstance(Locale.US));
    format.setRoundingMode(RoundingMode.HALF_UP);
    return format.format(value.setScale(2, RoundingMode.HALF_UP)) + "%";
  }

  private static String money(BigDecimal value) {
    if (value == null) {
      return "n/a";
    }
    DecimalFormat format =
        new DecimalFormat("#,##0.00", DecimalFormatSymbols.getInstance(Locale.US));
    format.setRoundingMode(RoundingMode.HALF_UP);
    return format.format(value.setScale(2, RoundingMode.HALF_UP));
  }

  private static final class PdfLayout implements AutoCloseable {
    private final PDDocument document;
    private final PDFont bodyFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private final PDFont boldFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
    private final List<PDPage> pages = new ArrayList<>();
    private PDPageContentStream stream;
    private float y;

    private PdfLayout(PDDocument document) {
      this.document = document;
    }

    private void startSectionPage(String title, String subtitle) throws IOException {
      startPage();
      drawText(stream, boldFont, 19f, MARGIN, y, title, TEXT_R, TEXT_G, TEXT_B);
      y -= 24f;
      drawText(stream, bodyFont, 9f, MARGIN, y, subtitle, MUTED_R, MUTED_G, MUTED_B);
      y -= 28f;
    }

    private void ensureSpace(float height) throws IOException {
      if (stream == null) {
        startPage();
      }
      if (y - height < FOOTER_LIMIT) {
        startPage();
        drawText(stream, boldFont, 10f, MARGIN, y, TITLE + " (continued)", TEXT_R, TEXT_G, TEXT_B);
        y -= 24f;
      }
    }

    private void startPage() throws IOException {
      closeStream();
      PDPage page = new PDPage(PDRectangle.LETTER);
      document.addPage(page);
      pages.add(page);
      stream = new PDPageContentStream(document, page);
      y = PAGE_HEIGHT - MARGIN;
    }

    private void setY(float value) {
      y = value;
    }

    private float y() {
      return y;
    }

    private PDPageContentStream stream() {
      return stream;
    }

    private PDFont bodyFont() {
      return bodyFont;
    }

    private PDFont boldFont() {
      return boldFont;
    }

    private List<PDPage> pages() {
      return pages;
    }

    private void closeStream() throws IOException {
      if (stream != null) {
        stream.close();
        stream = null;
      }
    }

    @Override
    public void close() throws IOException {
      closeStream();
    }
  }
}
