package com.propertyinsights.marketanalysis.export;

import com.propertyinsights.marketanalysis.analysis.SegmentFilter;
import com.propertyinsights.marketanalysis.analysis.SegmentFilterParameters;
import com.propertyinsights.marketanalysis.analysis.SegmentFilterParser;
import com.propertyinsights.marketanalysis.property.PropertyRecord;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api/v1/exports")
@Tag(name = "Exports", description = "CSV property data and market report downloads.")
public final class ExportController {

    private static final Logger LOGGER = LoggerFactory.getLogger(ExportController.class);

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

    @GetMapping("/properties.csv")
    @SegmentFilterParameters
    public ResponseEntity<StreamingResponseBody> propertiesCsv(
            @Parameter(hidden = true) @RequestParam MultiValueMap<String, String> params) {
        SegmentFilter filter = filterParser.parse(params);
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

    @GetMapping("/market-report.pdf")
    @SegmentFilterParameters
    public ResponseEntity<StreamingResponseBody> marketReportPdf(
            @Parameter(hidden = true) @RequestParam MultiValueMap<String, String> params) {
        SegmentFilter filter = filterParser.parse(params);
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
}
