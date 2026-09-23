package com.propertyinsights.marketanalysis.analysis;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class DistributionApiTest {

    @Autowired private MockMvc mockMvc;

    @Test
    void returnsStablePriceBucketsWithSnakeCaseFields() throws Exception {
        mockMvc.perform(get("/api/v1/properties/distributions/price").param("min_price", "200000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dimension").value("price"))
                .andExpect(jsonPath("$.matched_count").isNumber())
                .andExpect(jsonPath("$.buckets").isArray())
                .andExpect(jsonPath("$.buckets.length()").value(5))
                .andExpect(jsonPath("$.buckets[0].key").value("lt_200000"))
                .andExpect(jsonPath("$.buckets[0].count").value(0))
                .andExpect(jsonPath("$.buckets[0].average_price").value(nullValue()));
    }

    @Test
    void unknownDimensionReturnsProblemDetail() throws Exception {
        mockMvc.perform(get("/api/v1/properties/distributions/unknown"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.title").value("Bad Request"))
                .andExpect(jsonPath("$.detail").value("Unsupported distribution dimension."));
    }
}
