package com.propertyinsights.marketanalysis.whatif;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

@SpringBootTest
class ConfiguredModelPredictionClientTest {

    @Autowired private RestClient.Builder builder;

    @Test
    void springConfiguredClientSendsSnakeCaseModelFeatures() {
        builder.baseUrl("http://localhost:9003")
                .requestFactory(new SimpleClientHttpRequestFactory());
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        HttpModelPredictionClient client = new HttpModelPredictionClient(builder.build());

        server.expect(requestTo("http://localhost:9003/api/v1/predict"))
                .andExpect(
                        content()
                                .json(
                                        """
                        [
                          {
                            "square_footage": 1550,
                            "bedrooms": 3,
                            "bathrooms": 2.0,
                            "year_built": 1997,
                            "lot_size": 6800,
                            "distance_to_city_center": 4.1,
                            "school_rating": 7.6
                          },
                          {
                            "square_footage": 1800,
                            "bedrooms": 3,
                            "bathrooms": 2.0,
                            "year_built": 1997,
                            "lot_size": 6800,
                            "distance_to_city_center": 4.1,
                            "school_rating": 7.6
                          }
                        ]
                        """))
                .andRespond(
                        withSuccess(
                                "{\"count\":2,\"predictions\":[420000,465000]}",
                                MediaType.APPLICATION_JSON));

        HousingFeatures baseline =
                new HousingFeatures(
                        1550,
                        3,
                        new BigDecimal("2.0"),
                        1997,
                        6800,
                        new BigDecimal("4.1"),
                        new BigDecimal("7.6"));
        HousingFeatures scenario =
                new HousingFeatures(
                        1800,
                        3,
                        new BigDecimal("2.0"),
                        1997,
                        6800,
                        new BigDecimal("4.1"),
                        new BigDecimal("7.6"));

        assertThat(client.predict(List.of(baseline, scenario)))
                .containsExactly(new BigDecimal("420000"), new BigDecimal("465000"));
        server.verify();
    }
}
