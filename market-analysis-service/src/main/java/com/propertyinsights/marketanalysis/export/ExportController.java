package com.propertyinsights.marketanalysis.export;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.propertyinsights.marketanalysis.analysis.SegmentFilter;
import com.propertyinsights.marketanalysis.analysis.SegmentFilterParameters;
import com.propertyinsights.marketanalysis.analysis.SegmentFilterParser;
import com.propertyinsights.marketanalysis.error.ApiException;
import com.propertyinsights.marketanalysis.impact.ScenarioAdjustments;
import com.propertyinsights.marketanalysis.property.PropertyRecord;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api/v1/market/export")
@Tag(name = "Market")
public final class ExportController {

  private static final Logger LOGGER = LoggerFactory.getLogger(ExportController.class);
  private static final String INVALID_EXPORT = "Invalid or unsupported export parameters.";
  private static final String SCHOOL_RATING_DELTA = "scenario_school_rating_delta";
  private static final String SQUARE_FOOTAGE_PERCENT = "scenario_square_footage_percent";
  private static final String BEDROOMS_DELTA = "scenario_bedrooms_delta";
  private static final String BATHROOMS_DELTA = "scenario_bathrooms_delta";
  private static final String YEAR_BUILT_DELTA = "scenario_year_built_delta";
  private static final String LOT_SIZE_DELTA = "scenario_lot_size_delta";
  private static final String DISTANCE_TO_CITY_CENTER_DELTA =
      "scenario_distance_to_city_center_delta";
  private static final Map<String, String> SCENARIO_FIELDS =
      Map.of(
          SCHOOL_RATING_DELTA, "school_rating_delta",
          SQUARE_FOOTAGE_PERCENT, "square_footage_percent",
          BEDROOMS_DELTA, "bedrooms_delta",
          BATHROOMS_DELTA, "bathrooms_delta",
          YEAR_BUILT_DELTA, "year_built_delta",
          LOT_SIZE_DELTA, "lot_size_delta",
          DISTANCE_TO_CITY_CENTER_DELTA, "distance_to_city_center_delta");

  private final ObjectMapper objectMapper;
  private final SegmentFilterParser filterParser;
  private final ExportService exportService;
  private final CsvExportWriter csvWriter;
  private final PdfReportWriter pdfWriter;

  public ExportController(
      ObjectMapper objectMapper,
      SegmentFilterParser filterParser,
      ExportService exportService,
      CsvExportWriter csvWriter,
      PdfReportWriter pdfWriter) {
    this.objectMapper = objectMapper;
    this.filterParser = filterParser;
    this.exportService = exportService;
    this.csvWriter = csvWriter;
    this.pdfWriter = pdfWriter;
  }

  @GetMapping
  @SegmentFilterParameters
  public ResponseEntity<StreamingResponseBody> export(
      @Parameter(
              description = "Downloaded file format.",
              schema =
                  @Schema(
                      type = "string",
                      allowableValues = {"csv", "pdf"}))
          @RequestParam
          String format,
      @Parameter(
              description = "Optional additive school rating adjustment.",
              schema = @Schema(type = "number", format = "double"))
          @RequestParam(name = SCHOOL_RATING_DELTA, required = false)
          BigDecimal schoolRatingDelta,
      @Parameter(
              description = "Optional percentage change to square footage.",
              schema = @Schema(type = "number", format = "double"))
          @RequestParam(name = SQUARE_FOOTAGE_PERCENT, required = false)
          BigDecimal squareFootagePercent,
      @Parameter(
              description = "Optional integer change in bedroom count.",
              schema = @Schema(type = "integer", format = "int32"))
          @RequestParam(name = BEDROOMS_DELTA, required = false)
          BigDecimal bedroomsDelta,
      @Parameter(
              description = "Optional change in bathroom count.",
              schema = @Schema(type = "number", format = "double"))
          @RequestParam(name = BATHROOMS_DELTA, required = false)
          BigDecimal bathroomsDelta,
      @Parameter(
              description = "Optional integer change in year built.",
              schema = @Schema(type = "integer", format = "int32"))
          @RequestParam(name = YEAR_BUILT_DELTA, required = false)
          BigDecimal yearBuiltDelta,
      @Parameter(
              description = "Optional integer change in lot size.",
              schema = @Schema(type = "integer", format = "int32"))
          @RequestParam(name = LOT_SIZE_DELTA, required = false)
          BigDecimal lotSizeDelta,
      @Parameter(
              description = "Optional change in distance to city center.",
              schema = @Schema(type = "number", format = "double"))
          @RequestParam(name = DISTANCE_TO_CITY_CENTER_DELTA, required = false)
          BigDecimal distanceToCityCenterDelta,
      @Parameter(hidden = true) @RequestParam MultiValueMap<String, String> params) {
    validateFormat(format, params);
    MultiValueMap<String, String> filterParams = new LinkedMultiValueMap<>();
    Map<String, BigDecimal> scenarioValues = new LinkedHashMap<>();
    scenarioValues.put(SCHOOL_RATING_DELTA, schoolRatingDelta);
    scenarioValues.put(SQUARE_FOOTAGE_PERCENT, squareFootagePercent);
    scenarioValues.put(BEDROOMS_DELTA, bedroomsDelta);
    scenarioValues.put(BATHROOMS_DELTA, bathroomsDelta);
    scenarioValues.put(YEAR_BUILT_DELTA, yearBuiltDelta);
    scenarioValues.put(LOT_SIZE_DELTA, lotSizeDelta);
    scenarioValues.put(DISTANCE_TO_CITY_CENTER_DELTA, distanceToCityCenterDelta);
    ScenarioAdjustments scenario = parseScenario(params, filterParams, scenarioValues);
    SegmentFilter filter = filterParser.parse(filterParams);
    String analysisKey = AnalysisKey.from(filter, scenario);

    if (format.equals("csv")) {
      return exportPropertiesCsv(filter, scenario, analysisKey);
    }
    return exportMarketReportPdf(filter, scenario, analysisKey);
  }

  private ResponseEntity<StreamingResponseBody> exportPropertiesCsv(
      SegmentFilter filter, ScenarioAdjustments scenario, String analysisKey) {
    List<PropertyRecord> rows = exportService.properties(filter, scenario);

    LOGGER
        .atInfo()
        .addKeyValue("event", "market_csv_export_prepared")
        .addKeyValue("matched_count", rows.size())
        .addKeyValue("filter_count", filter.activeBounds().size())
        .log("Filtered market CSV export prepared");

    StreamingResponseBody body = output -> csvWriter.write(rows, output);
    return ResponseEntity.ok()
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            "attachment; filename=property-market-analysis_" + analysisKey + ".csv")
        .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
        .body(body);
  }

  private ResponseEntity<StreamingResponseBody> exportMarketReportPdf(
      SegmentFilter filter, ScenarioAdjustments scenario, String analysisKey) {
    ReportData report = exportService.report(filter, scenario);

    LOGGER
        .atInfo()
        .addKeyValue("event", "market_pdf_export_prepared")
        .addKeyValue("matched_count", report.summary().matchedCount())
        .addKeyValue("distribution_count", report.distributions().size())
        .log("Filtered market PDF export prepared");

    StreamingResponseBody body = output -> pdfWriter.write(report, output);
    return ResponseEntity.ok()
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            "attachment; filename=property-market-analysis_" + analysisKey + ".pdf")
        .contentType(MediaType.APPLICATION_PDF)
        .body(body);
  }

  private ScenarioAdjustments parseScenario(
      MultiValueMap<String, String> params,
      MultiValueMap<String, String> filterParams,
      Map<String, BigDecimal> scenarioValues) {
    ObjectNode adjustmentNode = objectMapper.createObjectNode();
    params.forEach(
        (name, values) -> {
          if (name.equals("format")) {
            return;
          }
          if (scenarioValues.containsKey(name)) {
            BigDecimal boundValue = scenarioValues.get(name);
            if (values == null || values.size() != 1) {
              throw invalidExport();
            }
            if (boundValue == null || decimalValue(values.getFirst()).compareTo(boundValue) != 0) {
              throw invalidExport();
            }
            return;
          }
          filterParams.put(name, values);
        });

    scenarioValues.forEach(
        (queryParameter, value) -> {
          String field = SCENARIO_FIELDS.get(queryParameter);
          if (value != null) adjustmentNode.put(field, value);
        });

    if (adjustmentNode.isEmpty()) {
      return null;
    }
    ScenarioAdjustments scenario = ScenarioAdjustments.parse(adjustmentNode);
    if (!scenario.hasEffectiveAdjustment()) {
      throw invalidExport();
    }
    return scenario;
  }

  private static BigDecimal decimalValue(String rawValue) {
    try {
      BigDecimal value = new BigDecimal(rawValue);
      if (!Double.isFinite(value.doubleValue())) {
        throw invalidExport();
      }
      return value;
    } catch (NumberFormatException exception) {
      throw invalidExport();
    }
  }

  private static void validateFormat(String format, MultiValueMap<String, String> params) {
    if (!List.of("csv", "pdf").contains(format)
        || params.getOrDefault("format", List.of()).size() != 1) {
      throw invalidExport();
    }
  }

  private static ApiException invalidExport() {
    return new ApiException(HttpStatus.BAD_REQUEST, INVALID_EXPORT);
  }
}
