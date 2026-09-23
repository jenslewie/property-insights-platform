package com.propertyinsights.marketanalysis.export;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@Import(ExportApiTest.FixedClockConfiguration.class)
class ExportApiTest {

    private static final Instant GENERATED_AT = Instant.parse("2026-09-23T00:00:00Z");

    @Autowired private MockMvc mockMvc;

    @Test
    void downloadsFilteredCsvAttachment() throws Exception {
        MvcResult started =
                mockMvc.perform(
                                get("/api/v1/properties/export")
                                        .param("type", "data")
                                        .param("format", "csv")
                                        .param("min_price", "350000"))
                        .andExpect(request().asyncStarted())
                        .andReturn();

        var response =
                mockMvc.perform(asyncDispatch(started))
                        .andExpect(status().isOk())
                        .andExpect(
                                header().string(
                                                "Content-Disposition",
                                                "attachment; filename=properties.csv"))
                        .andExpect(content().contentTypeCompatibleWith("text/csv"))
                        .andReturn()
                        .getResponse();

        String csv = response.getContentAsString(StandardCharsets.UTF_8);

        try (CSVParser parser = CSVParser.parse(csv, CSVFormat.DEFAULT)) {
            List<CSVRecord> records = parser.getRecords();

            assertThat(records).hasSize(13); // header + 12 matching CSV rows
            assertThat(records.getFirst().toList())
                    .containsExactly(
                            "id",
                            "square_footage",
                            "bedrooms",
                            "bathrooms",
                            "year_built",
                            "lot_size",
                            "distance_to_city_center",
                            "school_rating",
                            "price");

            for (CSVRecord record : records.subList(1, records.size())) {
                assertThat(record.get(8)).isNotBlank();
                assertThat(new java.math.BigDecimal(record.get(8)))
                        .isGreaterThanOrEqualTo(new java.math.BigDecimal("350000"));
            }
        }
    }

    @Test
    void downloadsFilteredPdfAttachment() throws Exception {
        MvcResult started =
                mockMvc.perform(
                                get("/api/v1/properties/export")
                                        .param("type", "report")
                                        .param("format", "pdf")
                                        .param("min_price", "350000"))
                        .andExpect(request().asyncStarted())
                        .andReturn();

        byte[] pdf =
                mockMvc.perform(asyncDispatch(started))
                        .andExpect(status().isOk())
                        .andExpect(
                                header().string(
                                                "Content-Disposition",
                                                "attachment; filename=market-report.pdf"))
                        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PDF))
                        .andReturn()
                        .getResponse()
                        .getContentAsByteArray();

        assertThat(new String(pdf, 0, 4, StandardCharsets.US_ASCII)).isEqualTo("%PDF");

        try (PDDocument document = Loader.loadPDF(pdf)) {
            String text = new PDFTextStripper().getText(document);

            assertThat(text)
                    .contains(
                            "Property Market Analysis - CSV sample",
                            GENERATED_AT.toString(),
                            "Matched records: 12");
        }
    }

    @Test
    void noMatchReturnsProblemDetailWithoutStartingDownload() throws Exception {
        mockMvc.perform(
                        get("/api/v1/properties/export")
                                .param("type", "data")
                                .param("format", "csv")
                                .param("min_price", "999999"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));

        mockMvc.perform(
                        get("/api/v1/properties/export")
                                .param("type", "report")
                                .param("format", "pdf")
                                .param("min_price", "999999"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }

    @Test
    void rejectsUnsupportedExportTypeAndFormatCombinations() throws Exception {
        for (String[] combination :
                List.of(
                        new String[] {"data", "pdf"},
                        new String[] {"report", "csv"},
                        new String[] {"unknown", "pdf"})) {
            mockMvc.perform(
                            get("/api/v1/properties/export")
                                    .param("type", combination[0])
                                    .param("format", combination[1]))
                    .andExpect(status().isBadRequest())
                    .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FixedClockConfiguration {

        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(GENERATED_AT, ZoneOffset.UTC);
        }
    }
}
