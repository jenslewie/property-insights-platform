package com.propertyinsights.marketanalysis.export;

import com.propertyinsights.marketanalysis.analysis.SegmentFilter;
import com.propertyinsights.marketanalysis.analysis.SegmentFilterParameters;
import com.propertyinsights.marketanalysis.analysis.SegmentFilterParser;
import com.propertyinsights.marketanalysis.error.ApiException;
import com.propertyinsights.marketanalysis.property.PropertyRecord;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
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
@RequestMapping("/api/v1/properties/export")
@Tag(name = "Properties")
public final class ExportController {

    private static final Logger LOGGER = LoggerFactory.getLogger(ExportController.class);
    private static final String INVALID_EXPORT = "Unsupported export type and format combination.";

    private final SegmentFilterParser filterParser;
    private final ExportService exportService;
    private final CsvExportWriter csvWriter;
    private final PdfReportWriter pdfWriter;

    public ExportController(
            SegmentFilterParser filterParser,
            ExportService exportService,
            CsvExportWriter csvWriter,
            PdfReportWriter pdfWriter) {
        this.filterParser = filterParser;
        this.exportService = exportService;
        this.csvWriter = csvWriter;
        this.pdfWriter = pdfWriter;
    }

    @GetMapping
    @SegmentFilterParameters
    public ResponseEntity<StreamingResponseBody> export(
            @Parameter(
                            description = "Export content type.",
                            schema =
                                    @Schema(
                                            type = "string",
                                            allowableValues = {"data", "report"}))
                    @RequestParam
                    String type,
            @Parameter(
                            description = "Downloaded file format.",
                            schema =
                                    @Schema(
                                            type = "string",
                                            allowableValues = {"csv", "pdf"}))
                    @RequestParam
                    String format,
            @Parameter(hidden = true) @RequestParam MultiValueMap<String, String> params) {
        validateExport(type, format, params);
        SegmentFilter filter = filterParser.parse(filterParams(params));

        if (type.equals("data") && format.equals("csv")) {
            return exportPropertiesCsv(filter);
        }

        if (type.equals("report") && format.equals("pdf")) {
            return exportMarketReportPdf(filter);
        }

        throw invalidExport();
    }

    private ResponseEntity<StreamingResponseBody> exportPropertiesCsv(SegmentFilter filter) {
        List<PropertyRecord> rows = exportService.properties(filter);

        LOGGER.atInfo()
                .addKeyValue("event", "property_csv_export_prepared")
                .addKeyValue("matched_count", rows.size())
                .addKeyValue("filter_count", filter.activeBounds().size())
                .log("Filtered property CSV export prepared");

        StreamingResponseBody body = output -> csvWriter.write(rows, output);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=properties.csv")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(body);
    }

    private ResponseEntity<StreamingResponseBody> exportMarketReportPdf(SegmentFilter filter) {
        ReportData report = exportService.report(filter);

        LOGGER.atInfo()
                .addKeyValue("event", "market_pdf_export_prepared")
                .addKeyValue("matched_count", report.summary().matchedCount())
                .addKeyValue("distribution_count", report.distributions().size())
                .log("Filtered market PDF export prepared");

        StreamingResponseBody body = output -> pdfWriter.write(report, output);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=market-report.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(body);
    }

    private static MultiValueMap<String, String> filterParams(
            MultiValueMap<String, String> params) {
        MultiValueMap<String, String> filterParams = new LinkedMultiValueMap<>();
        params.forEach(
                (name, values) -> {
                    if (!name.equals("type") && !name.equals("format")) {
                        filterParams.put(name, values);
                    }
                });
        return filterParams;
    }

    private static void validateExport(
            String type, String format, MultiValueMap<String, String> params) {
        if (params.getOrDefault("type", List.of()).size() != 1
                || params.getOrDefault("format", List.of()).size() != 1
                || !((type.equals("data") && format.equals("csv"))
                        || (type.equals("report") && format.equals("pdf")))) {
            throw invalidExport();
        }
    }

    private static ApiException invalidExport() {
        return new ApiException(HttpStatus.BAD_REQUEST, INVALID_EXPORT);
    }
}
