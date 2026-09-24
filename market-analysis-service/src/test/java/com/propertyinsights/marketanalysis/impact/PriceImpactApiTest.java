package com.propertyinsights.marketanalysis.impact;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.propertyinsights.marketanalysis.property.PropertyDataset;
import com.propertyinsights.marketanalysis.property.PropertyRecord;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class PriceImpactApiTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private ModelPredictionClient predictionClient;

    @MockitoBean private PropertyDataset dataset;

    @BeforeEach
    void setUp() {
        org.mockito.Mockito.when(dataset.all())
                .thenReturn(
                        List.of(
                                property(1, 1000, 2, "8"),
                                property(2, 1200, 3, "9"),
                                property(3, 1400, 3, "10")));
        doAnswer(
                        invocation ->
                                ((List<HousingFeatures>) invocation.getArgument(0))
                                        .stream()
                                                .map(
                                                        features ->
                                                                features.schoolRating()
                                                                        .multiply(
                                                                                new BigDecimal(
                                                                                        "100")))
                                                .toList())
                .when(predictionClient)
                .predict(anyList());
    }

    @Test
    void returnsSegmentLevelMetricsAndEvenMedian() throws Exception {
        mockMvc.perform(
                        post("/api/v1/market/price-impact")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        request(
                                                "{\"min_bedrooms\":3}",
                                                "{\"school_rating_delta\":1}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.property_count").value(2))
                .andExpect(jsonPath("$.baseline.mean").value(950))
                .andExpect(jsonPath("$.baseline.median").value(950))
                .andExpect(jsonPath("$.baseline.minimum").value(900))
                .andExpect(jsonPath("$.baseline.maximum").value(1000))
                .andExpect(jsonPath("$.scenario.mean").value(1050))
                .andExpect(jsonPath("$.scenario.median").value(1050))
                .andExpect(jsonPath("$.scenario.minimum").value(1000))
                .andExpect(jsonPath("$.scenario.maximum").value(1100))
                .andExpect(jsonPath("$.impact.mean.absolute_change").value(100))
                .andExpect(jsonPath("$.impact.mean.percentage_change").value(10.53))
                .andExpect(jsonPath("$.impact.median.absolute_change").value(100))
                .andExpect(jsonPath("$.impact.median.percentage_change").value(10.53));

        verify(predictionClient)
                .predict(
                        argThat(
                                features ->
                                        features.size() == 4
                                                && features.get(0)
                                                                .schoolRating()
                                                                .compareTo(new BigDecimal("9"))
                                                        == 0
                                                && features.get(1)
                                                                .schoolRating()
                                                                .compareTo(new BigDecimal("10"))
                                                        == 0
                                                && features.get(2)
                                                                .schoolRating()
                                                                .compareTo(new BigDecimal("10"))
                                                        == 0
                                                && features.get(3)
                                                                .schoolRating()
                                                                .compareTo(new BigDecimal("11"))
                                                        == 0));
    }

    @Test
    void filtersBeforeScenarioAdjustments() throws Exception {
        mockMvc.perform(
                        post("/api/v1/market/price-impact")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        request(
                                                "{\"min_school_rating\":9}",
                                                "{\"school_rating_delta\":1}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.property_count").value(2));

        verify(predictionClient)
                .predict(
                        argThat(
                                features ->
                                        features.size() == 4
                                                && features.get(0)
                                                                .schoolRating()
                                                                .compareTo(new BigDecimal("9"))
                                                        == 0));
    }

    @Test
    void returnsNullPercentageForZeroBaselineAndPreservesNegativeImpact() throws Exception {
        org.mockito.Mockito.when(dataset.all()).thenReturn(List.of(property(1, 1000, 3, "8")));
        org.mockito.Mockito.when(predictionClient.predict(anyList()))
                .thenReturn(List.of(BigDecimal.ZERO, BigDecimal.TEN));

        mockMvc.perform(
                        post("/api/v1/market/price-impact")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(request("{}", "{\"school_rating_delta\":1}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.baseline.mean").value(0))
                .andExpect(jsonPath("$.impact.mean.absolute_change").value(10))
                .andExpect(
                        jsonPath("$.impact.mean.percentage_change")
                                .value(org.hamcrest.Matchers.nullValue()));

        org.mockito.Mockito.when(predictionClient.predict(anyList()))
                .thenReturn(List.of(new BigDecimal("200"), new BigDecimal("100")));

        mockMvc.perform(
                        post("/api/v1/market/price-impact")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(request("{}", "{\"school_rating_delta\":1}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.impact.mean.absolute_change").value(-100))
                .andExpect(jsonPath("$.impact.mean.percentage_change").value(-50));
    }

    @Test
    void rejectsEmptySegmentNoOpAndOutOfBoundsScenarioWithoutModelCall() throws Exception {
        mockMvc.perform(
                        post("/api/v1/market/price-impact")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        request(
                                                "{\"min_bedrooms\":9}",
                                                "{\"school_rating_delta\":1}")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detail").value("No properties match the market filters."));

        mockMvc.perform(
                        post("/api/v1/market/price-impact")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(request("{}", "{\"school_rating_delta\":0}")))
                .andExpect(status().isUnprocessableEntity());

        org.mockito.Mockito.when(dataset.all()).thenReturn(List.of(property(1, 1000, 3, "20")));
        mockMvc.perform(
                        post("/api/v1/market/price-impact")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(request("{}", "{\"school_rating_delta\":1}")))
                .andExpect(status().isUnprocessableEntity());

        verifyNoInteractions(predictionClient);
    }

    @Test
    void rejectsUnknownAdjustmentsAndLegacyPropertyRequest() throws Exception {
        mockMvc.perform(
                        post("/api/v1/market/price-impact")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(request("{}", "{\"garage_spaces\":1}")))
                .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(
                        post("/api/v1/market/price-impact")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"baseline\":{},\"changes\":{\"bedrooms\":4}}"))
                .andExpect(status().isUnprocessableEntity());

        verifyNoInteractions(predictionClient);
    }

    @Test
    void batchesFiftyPropertiesAtTwentyInputsAndKeepsSourceOrder() throws Exception {
        List<PropertyRecord> rows = new ArrayList<>();
        for (int index = 0; index < 50; index++) {
            rows.add(property(index + 1L, 1000 + index, 3, Integer.toString(1 + index % 10)));
        }
        org.mockito.Mockito.when(dataset.all()).thenReturn(rows);

        List<List<HousingFeatures>> calls = new ArrayList<>();
        doAnswer(
                        invocation -> {
                            List<HousingFeatures> input = invocation.getArgument(0);
                            calls.add(List.copyOf(input));
                            return input.stream()
                                    .map(features -> BigDecimal.valueOf(features.squareFootage()))
                                    .toList();
                        })
                .when(predictionClient)
                .predict(anyList());

        mockMvc.perform(
                        post("/api/v1/market/price-impact")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(request("{}", "{\"school_rating_delta\":1}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.property_count").value(50));

        assertThat(calls).hasSize(5);
        assertThat(calls).allSatisfy(batch -> assertThat(batch).hasSize(20));
        assertThat(calls.getFirst().get(0).squareFootage()).isEqualTo(1000);
        assertThat(calls.getFirst().get(1).squareFootage()).isEqualTo(1000);
        assertThat(calls.getFirst().get(2).squareFootage()).isEqualTo(1001);
        assertThat(calls.getLast().get(18).squareFootage()).isEqualTo(1049);
    }

    @Test
    void malformedJsonReturnsProblemDetail() throws Exception {
        mockMvc.perform(
                        post("/api/v1/market/price-impact")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"filters\":"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));

        verifyNoInteractions(predictionClient);
    }

    private String request(String filters, String adjustments) {
        return """
                {
                  "filters": %s,
                  "scenario": {
                    "adjustments": %s
                  }
                }
                """
                .formatted(filters, adjustments);
    }

    private PropertyRecord property(long id, int squareFootage, int bedrooms, String schoolRating) {
        return new PropertyRecord(
                id,
                squareFootage,
                bedrooms,
                new BigDecimal("2.0"),
                1997,
                6800,
                new BigDecimal("4.1"),
                new BigDecimal(schoolRating),
                new BigDecimal("200000"));
    }
}
