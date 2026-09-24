package com.propertyinsights.marketanalysis.export;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.propertyinsights.marketanalysis.error.ApiException;
import com.propertyinsights.marketanalysis.impact.HousingFeatures;
import com.propertyinsights.marketanalysis.impact.ModelPredictionClient;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@Import(ExportApiTest.FixedClockConfiguration.class)
class ExportApiTest {

  private static final Instant GENERATED_AT = Instant.parse("2026-09-23T00:00:00Z");
  private static final String EXPORT_PATH = "/api/v1/market/export";

  @Autowired private MockMvc mockMvc;

  @MockitoBean private ModelPredictionClient predictionClient;

  @BeforeEach
  void setUp() {
    doAnswer(
            invocation ->
                ((List<HousingFeatures>) invocation.getArgument(0))
                    .stream()
                        .map(features -> BigDecimal.valueOf(features.squareFootage() * 100L))
                        .toList())
        .when(predictionClient)
        .predict(anyList());
  }

  @Test
  void csvKeepsFilteredRowsWhilePdfProvidesAggregateScenarioReport() throws Exception {
    String csvFilename =
        downloadCsv(
            get(EXPORT_PATH)
                .param("format", "csv")
                .param("min_price", "350000")
                .param("scenario_school_rating_delta", "0.5")
                .param("scenario_square_footage_percent", "5")
                .param("scenario_bedrooms_delta", "1")
                .param("scenario_bathrooms_delta", "0.5")
                .param("scenario_year_built_delta", "5")
                .param("scenario_lot_size_delta", "500")
                .param("scenario_distance_to_city_center_delta", "0.5"));
    String csv = lastCsv;

    verifyNoInteractions(predictionClient);

    MvcResult started =
        mockMvc
            .perform(
                get(EXPORT_PATH)
                    .param("format", "pdf")
                    .param("min_price", "350000")
                    .param("scenario_school_rating_delta", "0.5")
                    .param("scenario_square_footage_percent", "5")
                    .param("scenario_bedrooms_delta", "1")
                    .param("scenario_bathrooms_delta", "0.5")
                    .param("scenario_year_built_delta", "5")
                    .param("scenario_lot_size_delta", "500")
                    .param("scenario_distance_to_city_center_delta", "0.5"))
            .andExpect(request().asyncStarted())
            .andReturn();
    byte[] pdf =
        mockMvc
            .perform(asyncDispatch(started))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Disposition", csvFilename.replace(".csv", ".pdf")))
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PDF))
            .andReturn()
            .getResponse()
            .getContentAsByteArray();

    assertThat(new String(pdf, 0, 4, StandardCharsets.US_ASCII)).isEqualTo("%PDF");
    List<Long> csvIds = csvIds(csv);
    assertThat(csvIds).containsExactly(7L, 9L, 13L, 15L, 19L, 22L, 26L, 34L, 37L, 39L, 43L, 49L);
    try (CSVParser parser = CSVParser.parse(csv, CSVFormat.DEFAULT)) {
      assertThat(parser.getRecords())
          .hasSize(13)
          .allSatisfy(record -> assertThat(record).hasSize(9));
    }
    try (PDDocument document = Loader.loadPDF(pdf)) {
      assertThat(document.getNumberOfPages()).isEqualTo(3);
      String text = new PDFTextStripper().getText(document);
      assertThat(text)
          .contains(
              "Property Market Analysis",
              "MATCHED PROPERTIES",
              "Price distribution",
              "Square footage",
              "Bedrooms",
              "Bathrooms",
              "Year built",
              "Lot size",
              "Distance to city center",
              "School rating",
              "Predicted baseline",
              "Square footage: +5%",
              "Bedrooms: +1",
              "Bathrooms: +0.5",
              "Year built: +5",
              "Lot size: +500",
              "Distance to city center: +0.5",
              "School rating: +0.5",
              "Selected properties: 12",
              GENERATED_AT.toString())
          .doesNotContain("Property ID:", "square_footage", "key=", "range=", "historical_price=");
    }
    verify(predictionClient, times(2)).predict(anyList());
  }

  @Test
  void equivalentFiltersAndScenarioValuesProduceTheSameFilename() throws Exception {
    String first =
        downloadCsv(
            get(EXPORT_PATH)
                .param("format", "csv")
                .param("min_price", "350000")
                .param("max_bedrooms", "4")
                .param("scenario_school_rating_delta", "1.00"));
    String second =
        downloadCsv(
            get(EXPORT_PATH)
                .param("scenario_school_rating_delta", "1.0")
                .param("max_bedrooms", "4.0")
                .param("format", "csv")
                .param("min_price", "350000.0"));

    assertThat(second).isEqualTo(first);

    String firstPdf =
        downloadPdfFilename(
            get(EXPORT_PATH)
                .param("format", "pdf")
                .param("min_price", "350000")
                .param("max_bedrooms", "4")
                .param("scenario_school_rating_delta", "1.00"));
    String equivalentPdf =
        downloadPdfFilename(
            get(EXPORT_PATH)
                .param("scenario_school_rating_delta", "1.0")
                .param("max_bedrooms", "4.0")
                .param("format", "pdf")
                .param("min_price", "350000.0"));
    assertThat(firstPdf).isEqualTo(first.replace(".csv", ".pdf"));
    assertThat(equivalentPdf).isEqualTo(firstPdf);

    String changedScenario =
        downloadCsv(
            get(EXPORT_PATH)
                .param("format", "csv")
                .param("min_price", "350000")
                .param("max_bedrooms", "4")
                .param("scenario_school_rating_delta", "0.5"));
    assertThat(changedScenario).isNotEqualTo(first);
  }

  @Test
  void unfilteredExportsUseTheDocumentedAnalysisKey() throws Exception {
    String filename = downloadCsv(get(EXPORT_PATH).param("format", "csv"));
    assertThat(filename)
        .isEqualTo("attachment; filename=property-market-analysis_" + "145a21b6.csv");
  }

  @Test
  void rejectsUnknownDuplicateAndLegacyParameters() throws Exception {
    for (var requestBuilder :
        List.of(
            get(EXPORT_PATH).param("format", "csv").param("type", "data"),
            get(EXPORT_PATH).param("format", "csv", "pdf"),
            get(EXPORT_PATH).param("format", "csv").param("scenario_school_rating_delta", "1", "2"),
            get(EXPORT_PATH).param("format", "csv").param("unknown", "x"),
            get(EXPORT_PATH).param("format", "csv").param("scenario_school_rating_delta", "0"))) {
      mockMvc
          .perform(requestBuilder)
          .andExpect(status().isBadRequest())
          .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }
    verifyNoInteractions(predictionClient);
  }

  @Test
  void noMatchReturnsProblemDetailBeforeStartingDownload() throws Exception {
    mockMvc
        .perform(get(EXPORT_PATH).param("format", "csv").param("min_price", "999999"))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith("application/problem+json"));

    mockMvc
        .perform(get(EXPORT_PATH).param("format", "pdf").param("min_price", "999999"))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
  }

  @Test
  void modelFailureRejectsPdfBeforeStreamingStarts() throws Exception {
    org.mockito.Mockito.when(predictionClient.predict(anyList()))
        .thenThrow(
            new ApiException(
                org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                "Model service is unavailable."));

    mockMvc
        .perform(
            get(EXPORT_PATH)
                .param("format", "pdf")
                .param("min_price", "350000")
                .param("scenario_school_rating_delta", "0.5"))
        .andExpect(status().isServiceUnavailable())
        .andExpect(request().asyncNotStarted())
        .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
  }

  private String lastCsv;

  private String downloadPdfFilename(
      org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder)
      throws Exception {
    MvcResult started = mockMvc.perform(builder).andExpect(request().asyncStarted()).andReturn();
    return mockMvc
        .perform(asyncDispatch(started))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PDF))
        .andReturn()
        .getResponse()
        .getHeader("Content-Disposition");
  }

  private String downloadCsv(
      org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder)
      throws Exception {
    MvcResult started = mockMvc.perform(builder).andExpect(request().asyncStarted()).andReturn();
    var response =
        mockMvc
            .perform(asyncDispatch(started))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith("text/csv"))
            .andReturn()
            .getResponse();
    String disposition = response.getHeader("Content-Disposition");
    lastCsv = response.getContentAsString(StandardCharsets.UTF_8);
    return disposition;
  }

  private List<Long> csvIds(String csv) throws Exception {
    try (CSVParser parser = CSVParser.parse(csv, CSVFormat.DEFAULT)) {
      return parser.getRecords().stream()
          .skip(1)
          .map(record -> record.get(0))
          .map(Long::valueOf)
          .toList();
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
