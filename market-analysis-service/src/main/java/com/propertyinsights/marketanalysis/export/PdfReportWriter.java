package com.propertyinsights.marketanalysis.export;

import com.propertyinsights.marketanalysis.analysis.DistributionBucket;
import com.propertyinsights.marketanalysis.analysis.DistributionDimension;
import com.propertyinsights.marketanalysis.analysis.DistributionResponse;
import com.propertyinsights.marketanalysis.analysis.MarketSummary;
import com.propertyinsights.marketanalysis.analysis.SegmentFilter;
import com.propertyinsights.marketanalysis.impact.PriceImpactResponse;
import com.propertyinsights.marketanalysis.impact.ScenarioAdjustments;
import com.propertyinsights.marketanalysis.property.PropertyRecord;
import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
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
  private static final float MARGIN = 48;
  private static final float BOTTOM_MARGIN = 48;
  private static final float LINE_HEIGHT = 14;

  public void write(ReportData report, OutputStream output) throws IOException {
    try (PDDocument document = new PDDocument()) {
      try (PageWriter pages = new PageWriter(document)) {
        pages.writeLine(TITLE, pages.headingFont(), 16);
        pages.writeLine(
            "Historical metrics describe source prices; scenario metrics are model predictions.",
            pages.bodyFont(),
            10);
        pages.writeLine("Generated at (UTC): " + report.generatedAt(), pages.bodyFont(), 10);
        pages.writeLine("", pages.bodyFont(), 10);

        writeFilters(pages, report.filter());
        pages.writeLine("", pages.bodyFont(), 10);
        writeSummary(pages, report.summary());

        if (report.scenario() != null && report.priceImpact() != null) {
          writeScenario(pages, report.scenario(), report.priceImpact());
        }

        for (DistributionDimension dimension : DistributionDimension.values()) {
          writeDistribution(pages, dimension, report.distributions().get(dimension));
        }

        writeProperties(pages, report.properties());
      }

      document.save(output);
    }
  }

  private static void writeFilters(PageWriter pages, SegmentFilter filter) throws IOException {
    Map<String, SegmentFilter.Bounds> activeBounds = filter.activeBounds();

    pages.writeLine("Active filters:", pages.headingFont(), 11);

    if (activeBounds.isEmpty()) {
      pages.writeLine("  None (full CSV sample)", pages.bodyFont(), 9);
      return;
    }

    for (Map.Entry<String, SegmentFilter.Bounds> entry : activeBounds.entrySet()) {
      SegmentFilter.Bounds bounds = entry.getValue();
      StringBuilder line = new StringBuilder("  ").append(entry.getKey()).append(": ");

      if (bounds.min() != null) {
        line.append("min >= ").append(filterValue(bounds.min()));
      }
      if (bounds.min() != null && bounds.max() != null) {
        line.append(", ");
      }
      if (bounds.max() != null) {
        line.append("max <= ").append(filterValue(bounds.max()));
      }

      pages.writeLine(line.toString(), pages.bodyFont(), 9);
    }
  }

  private static String filterValue(BigDecimal value) {
    long maximumPlainLength = (long) value.precision() + Math.abs((long) value.scale()) + 2;
    return maximumPlainLength > 512 ? value.toString() : value.toPlainString();
  }

  private static void writeSummary(PageWriter pages, MarketSummary summary) throws IOException {
    MarketSummary.PriceStats price = summary.price();

    pages.writeLine("Historical price summary:", pages.headingFont(), 11);
    pages.writeLine("Total records: " + summary.totalCount(), pages.bodyFont(), 9);
    pages.writeLine("Matched records: " + summary.matchedCount(), pages.bodyFont(), 9);
    pages.writeLine("Mean price: " + money(price.mean()), pages.bodyFont(), 9);
    pages.writeLine("Median price: " + money(price.median()), pages.bodyFont(), 9);
    pages.writeLine("Minimum price: " + money(price.minimum()), pages.bodyFont(), 9);
    pages.writeLine("Maximum price: " + money(price.maximum()), pages.bodyFont(), 9);
  }

  private static void writeScenario(
      PageWriter pages, ScenarioAdjustments scenario, PriceImpactResponse impact)
      throws IOException {
    pages.writeLine("", pages.bodyFont(), 9);
    pages.writeLine("Scenario assumptions:", pages.headingFont(), 11);
    pages.writeLine(
        "school_rating_delta: " + adjustment(scenario.schoolRatingDelta()), pages.bodyFont(), 9);
    pages.writeLine(
        "square_footage_percent: " + adjustment(scenario.squareFootagePercent()),
        pages.bodyFont(),
        9);
    pages.writeLine("bedrooms_delta: " + adjustment(scenario.bedroomsDelta()), pages.bodyFont(), 9);
    pages.writeLine(
        "bathrooms_delta: " + adjustment(scenario.bathroomsDelta()), pages.bodyFont(), 9);
    pages.writeLine(
        "year_built_delta: " + adjustment(scenario.yearBuiltDelta()), pages.bodyFont(), 9);
    pages.writeLine("lot_size_delta: " + adjustment(scenario.lotSizeDelta()), pages.bodyFont(), 9);
    pages.writeLine(
        "distance_to_city_center_delta: " + adjustment(scenario.distanceToCityCenterDelta()),
        pages.bodyFont(),
        9);
    pages.writeLine("Predicted baseline and scenario:", pages.headingFont(), 11);
    pages.writeLine("Selected properties: " + impact.propertyCount(), pages.bodyFont(), 9);
    writePredictedMetric(
        pages, "Mean", impact.baseline().mean(), impact.scenario().mean(), impact.impact().mean());
    writePredictedMetric(
        pages,
        "Median",
        impact.baseline().median(),
        impact.scenario().median(),
        impact.impact().median());
    writePredictedMetric(
        pages,
        "Minimum",
        impact.baseline().minimum(),
        impact.scenario().minimum(),
        impact.impact().minimum());
    writePredictedMetric(
        pages,
        "Maximum",
        impact.baseline().maximum(),
        impact.scenario().maximum(),
        impact.impact().maximum());
  }

  private static void writePredictedMetric(
      PageWriter pages,
      String label,
      BigDecimal baseline,
      BigDecimal scenario,
      PriceImpactResponse.MetricImpact impact)
      throws IOException {
    pages.writeLine(
        label
            + " predicted price: baseline="
            + money(baseline)
            + ", scenario="
            + money(scenario)
            + ", change="
            + money(impact.absoluteChange())
            + " ("
            + percentage(impact.percentageChange())
            + ")",
        pages.bodyFont(),
        9);
  }

  private static String adjustment(BigDecimal value) {
    return value == null ? "unchanged" : value.stripTrailingZeros().toPlainString();
  }

  private static String percentage(BigDecimal value) {
    return value == null ? "n/a" : value.setScale(2, RoundingMode.HALF_UP).toPlainString() + "%";
  }

  private static void writeProperties(PageWriter pages, java.util.List<PropertyRecord> rows)
      throws IOException {
    pages.writeLine("", pages.bodyFont(), 9);
    pages.writeLine("Filtered source property records:", pages.headingFont(), 11);
    for (PropertyRecord row : rows) {
      pages.writeLine("Property ID: " + row.id(), pages.headingFont(), 9);
      pages.writeLine(
          "Source: square_footage="
              + row.squareFootage()
              + ", bedrooms="
              + row.bedrooms()
              + ", bathrooms="
              + row.bathrooms().toPlainString()
              + ", year_built="
              + row.yearBuilt()
              + ", lot_size="
              + row.lotSize()
              + ", distance_to_city_center="
              + row.distanceToCityCenter().toPlainString()
              + ", school_rating="
              + row.schoolRating().toPlainString()
              + ", historical_price="
              + money(row.price()),
          pages.bodyFont(),
          8);
    }
  }

  private static void writeDistribution(
      PageWriter pages, DistributionDimension dimension, DistributionResponse distribution)
      throws IOException {
    pages.writeLine("", pages.bodyFont(), 9);
    pages.writeLine("Distribution: " + dimension.path(), pages.headingFont(), 11);

    if (distribution == null || distribution.buckets().isEmpty()) {
      pages.writeLine("  No buckets", pages.bodyFont(), 9);
      return;
    }

    for (DistributionBucket bucket : distribution.buckets()) {
      pages.writeLine(
          "  key="
              + bucket.key()
              + " label="
              + bucket.label()
              + " range="
              + range(bucket)
              + " count="
              + bucket.count()
              + " average_price="
              + money(bucket.averagePrice()),
          pages.bodyFont(),
          8);
    }
  }

  private static String range(DistributionBucket bucket) {
    if (bucket.exactValue() != null) {
      return "value=" + bucket.exactValue().toPlainString();
    }

    String min = bucket.minInclusive() == null ? "none" : bucket.minInclusive().toPlainString();
    String max = bucket.maxExclusive() == null ? "none" : bucket.maxExclusive().toPlainString();

    return "min=" + min + ",max_exclusive=" + max;
  }

  private static String money(BigDecimal value) {
    return value == null ? "n/a" : value.setScale(2, RoundingMode.HALF_UP).toPlainString();
  }

  private static final class PageWriter implements AutoCloseable {

    private final PDDocument document;
    private final PDFont bodyFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    private final PDFont headingFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

    private PDPageContentStream stream;
    private float y;

    private PageWriter(PDDocument document) {
      this.document = document;
    }

    private PDFont bodyFont() {
      return bodyFont;
    }

    private PDFont headingFont() {
      return headingFont;
    }

    private void writeLine(String text, PDFont font, float fontSize) throws IOException {
      float availableWidth = PDRectangle.LETTER.getWidth() - MARGIN * 2;
      if (text.isEmpty()) {
        writePhysicalLine(text, font, fontSize);
        return;
      }

      int start = 0;
      while (start < text.length()) {
        int end = start;
        int lastWhitespace = -1;
        float width = 0;
        while (end < text.length()) {
          float characterWidth =
              font.getStringWidth(text.substring(end, end + 1)) * fontSize / 1000;
          if (end > start && width + characterWidth > availableWidth) {
            break;
          }
          if (Character.isWhitespace(text.charAt(end))) {
            lastWhitespace = end;
          }
          width += characterWidth;
          end++;
        }

        if (end < text.length() && lastWhitespace > start) {
          end = lastWhitespace;
        }
        writePhysicalLine(text.substring(start, end).stripTrailing(), font, fontSize);
        start = end;
        while (start < text.length() && Character.isWhitespace(text.charAt(start))) {
          start++;
        }
      }
    }

    private void writePhysicalLine(String text, PDFont font, float fontSize) throws IOException {
      if (stream == null) {
        startPage(false);
      }
      if (y - LINE_HEIGHT < BOTTOM_MARGIN) {
        startPage(true);
      }

      stream.beginText();
      stream.setFont(font, fontSize);
      stream.newLineAtOffset(MARGIN, y);
      stream.showText(text);
      stream.endText();

      y -= LINE_HEIGHT;
    }

    private void startPage(boolean continued) throws IOException {
      closeStream();

      PDPage page = new PDPage(PDRectangle.LETTER);
      document.addPage(page);
      stream = new PDPageContentStream(document, page);
      y = PDRectangle.LETTER.getHeight() - MARGIN;

      if (continued) {
        stream.beginText();
        stream.setFont(headingFont, 10);
        stream.newLineAtOffset(MARGIN, y);
        stream.showText(TITLE + " (continued)");
        stream.endText();
        y -= LINE_HEIGHT * 2;
      }
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
