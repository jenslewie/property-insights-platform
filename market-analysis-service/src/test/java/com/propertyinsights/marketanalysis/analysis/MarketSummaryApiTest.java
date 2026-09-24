package com.propertyinsights.marketanalysis.analysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootTest
@AutoConfigureMockMvc
@Import(MarketSummaryApiTest.UnexpectedExceptionController.class)
class MarketSummaryApiTest {

    @Autowired private MockMvc mockMvc;

    @Test
    void returnsUnfilteredSummary() throws Exception {
        mockMvc.perform(get("/api/v1/market/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total_count").value(50))
                .andExpect(jsonPath("$.matched_count").value(50))
                .andExpect(jsonPath("$.price.mean").value(264600.0))
                .andExpect(jsonPath("$.price.median").value(245000.0))
                .andExpect(jsonPath("$.price.minimum").value(160000.0))
                .andExpect(jsonPath("$.price.maximum").value(410000.0));
    }

    @Test
    void zeroMatchSummaryKeepsNullHistoricalStatistics() throws Exception {
        mockMvc.perform(get("/api/v1/market/summary").param("min_price", "999999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total_count").value(50))
                .andExpect(jsonPath("$.matched_count").value(0))
                .andExpect(jsonPath("$.price.mean").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.price.median").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.price.minimum").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.price.maximum").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void invalidFiltersReturnProblemDetails() throws Exception {
        assertBadFilter(
                get("/api/v1/market/summary").param("min_bedrooms", "2.5"),
                "Invalid or unsupported filter parameter.");
        assertBadFilter(
                get("/api/v1/market/summary").param("min_price", "1", "2"),
                "Invalid or unsupported filter parameter.");
        assertBadFilter(
                get("/api/v1/market/summary").param("min_price", "NaN"),
                "Invalid or unsupported filter parameter.");
        assertBadFilter(
                get("/api/v1/market/summary").param("sort", "price"),
                "Invalid or unsupported filter parameter.");
        assertBadFilter(
                get("/api/v1/market/summary").param("min_price", "300").param("max_price", "200"),
                "Minimum filter value must not exceed maximum.");
    }

    @Test
    void unexpectedFailureReturnsSafeProblemDetail() throws Exception {
        var result =
                mockMvc.perform(get("/test/unexpected"))
                        .andExpect(status().isInternalServerError())
                        .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                        .andExpect(jsonPath("$.status").value(500))
                        .andExpect(jsonPath("$.title").value("Internal Server Error"))
                        .andExpect(jsonPath("$.detail").value("An unexpected error occurred."))
                        .andReturn();

        assertThat(result.getResponse().getContentAsString())
                .doesNotContain("private test exception");
    }

    @Test
    void frameworkRequestErrorsKeepTheirHttpStatus() throws Exception {
        mockMvc.perform(post("/api/v1/properties"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(405))
                .andExpect(
                        org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                                .string(HttpHeaders.ALLOW, "GET"));

        mockMvc.perform(
                        post("/api/v1/market/price-impact")
                                .contentType(MediaType.TEXT_PLAIN)
                                .content("invalid"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(415));
    }

    private void assertBadFilter(MockHttpServletRequestBuilder request, String expectedDetail)
            throws Exception {
        mockMvc.perform(request)
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.title").value("Bad Request"))
                .andExpect(jsonPath("$.detail").value(expectedDetail));
    }

    @RestController
    static class UnexpectedExceptionController {

        @GetMapping("/test/unexpected")
        String fail() {
            throw new IllegalStateException("private test exception");
        }
    }
}
