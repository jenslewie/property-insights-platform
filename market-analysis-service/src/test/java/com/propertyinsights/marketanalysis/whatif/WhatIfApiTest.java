package com.propertyinsights.marketanalysis.whatif;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
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
class WhatIfApiTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private ModelPredictionClient predictionClient;

    @BeforeEach
    void setUp() {
        when(predictionClient.predict(anyList()))
                .thenReturn(List.of(new BigDecimal("420000"), new BigDecimal("465000")));
    }

    @Test
    void returnsWhatIfEstimatesAndOnlyChangedFeatures() throws Exception {
        var result =
                mockMvc.perform(
                                post("/api/v1/what-if")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(validRequest()))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.baseline.square_footage").value(1550))
                        .andExpect(jsonPath("$.changes.square_footage.from").value(1550))
                        .andExpect(jsonPath("$.changes.square_footage.to").value(1800))
                        .andExpect(jsonPath("$.changes.school_rating.from").value(7.6))
                        .andExpect(jsonPath("$.changes.school_rating.to").value(8.5))
                        .andExpect(jsonPath("$.changes.bedrooms").doesNotExist())
                        .andExpect(jsonPath("$.baseline_estimate").value(420000))
                        .andExpect(jsonPath("$.scenario_estimate").value(465000))
                        .andExpect(jsonPath("$.absolute_change").value(45000))
                        .andExpect(jsonPath("$.percentage_change").value(10.71))
                        .andReturn();

        assertThat(result.getResponse().getContentAsString()).doesNotContain("\"scenario\"");

        verify(predictionClient)
                .predict(
                        argThat(
                                features ->
                                        features.size() == 2
                                                && features.getFirst().squareFootage() == 1550
                                                && features.get(1).squareFootage() == 1800));
    }

    @Test
    void doesNotCacheModelPredictions() throws Exception {
        mockMvc.perform(
                        post("/api/v1/what-if")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(validRequest()))
                .andExpect(status().isOk());

        mockMvc.perform(
                        post("/api/v1/what-if")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(validRequest()))
                .andExpect(status().isOk());

        verify(predictionClient, times(2)).predict(anyList());
    }

    @Test
    void invalidChangesReturnProblemDetailWithoutCallingModel() throws Exception {
        mockMvc.perform(
                        post("/api/v1/what-if")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(requestWithChanges("{}")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(422))
                .andExpect(jsonPath("$.detail").value("Invalid what-if request."));

        verifyNoInteractions(predictionClient);
    }

    @Test
    void malformedJsonReturnsProblemDetail() throws Exception {
        mockMvc.perform(
                        post("/api/v1/what-if")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"baseline\":"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(422))
                .andExpect(
                        jsonPath("$.detail").value("Malformed or unreadable JSON request body."));

        verifyNoInteractions(predictionClient);
    }

    @Test
    void extraTopLevelRequestFieldsAreRejected() throws Exception {
        mockMvc.perform(
                        post("/api/v1/what-if")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                {
                                  "baseline": {},
                                  "changes": {"square_footage": 1800},
                                  "scenario": {}
                                }
                                """))
                .andExpect(status().isUnprocessableEntity());

        verifyNoInteractions(predictionClient);
    }

    private String validRequest() {
        return """
                {
                  "baseline": {
                    "square_footage": 1550,
                    "bedrooms": 3,
                    "bathrooms": 2.0,
                    "year_built": 1997,
                    "lot_size": 6800,
                    "distance_to_city_center": 4.1,
                    "school_rating": 7.6
                  },
                  "changes": {
                    "square_footage": 1800,
                    "school_rating": 8.5
                  }
                }
                """;
    }

    private String requestWithChanges(String changes) {
        return """
                {
                  "baseline": {
                    "square_footage": 1550,
                    "bedrooms": 3,
                    "bathrooms": 2.0,
                    "year_built": 1997,
                    "lot_size": 6800,
                    "distance_to_city_center": 4.1,
                    "school_rating": 7.6
                  },
                  "changes": %s
                }
                """
                .formatted(changes);
    }
}
