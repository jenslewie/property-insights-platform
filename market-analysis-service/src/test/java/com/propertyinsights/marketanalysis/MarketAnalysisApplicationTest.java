package com.propertyinsights.marketanalysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.propertyinsights.marketanalysis.impact.ModelPredictionClient;
import com.propertyinsights.marketanalysis.property.PropertyDataset;
import java.nio.file.NoSuchFileException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class MarketAnalysisApplicationTest {

    @Autowired private MockMvc mvc;

    @Autowired private PropertyDataset dataset;

    @MockitoBean private ModelPredictionClient modelPredictionClient;

    @Test
    void startsWithValidatedDatasetAndServesHealth() throws Exception {
        assertThat(dataset.all()).hasSize(50);

        mvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        verifyNoInteractions(modelPredictionClient);
    }

    @Test
    void invalidDatasetStopsStartup() {
        new ApplicationContextRunner()
                .withInitializer(new ConfigDataApplicationContextInitializer())
                .withUserConfiguration(MarketAnalysisApplication.class)
                .withPropertyValues("market.dataset-path=/path/that/does/not/exist.csv")
                .run(
                        context ->
                                assertThat(context.getStartupFailure())
                                        .isNotNull()
                                        .hasRootCauseInstanceOf(NoSuchFileException.class));
    }
}
