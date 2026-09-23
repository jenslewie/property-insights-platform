package com.propertyinsights.marketanalysis.property;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class PropertyApiTest {

    @Autowired private MockMvc mockMvc;

    @Test
    void propertiesEndpointReturnsCompleteDatasetInSourceOrder() throws Exception {
        mockMvc.perform(get("/api/v1/properties"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(50))
                .andExpect(jsonPath("$.properties", hasSize(50)))
                .andExpect(jsonPath("$.properties[0].id").value(1))
                .andExpect(jsonPath("$.properties[0].square_footage").value(1250))
                .andExpect(jsonPath("$.properties[0].price").value(185000));
    }

    @Test
    void propertiesEndpointReturnsCompleteDatasetWithoutApplyingQueryParameters() throws Exception {
        mockMvc.perform(get("/api/v1/properties").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(50))
                .andExpect(jsonPath("$.properties", hasSize(50)));
    }
}
