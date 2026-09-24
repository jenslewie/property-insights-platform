package com.propertyinsights.marketanalysis.impact;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.propertyinsights.marketanalysis.error.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.SocketTimeoutException;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.mock.http.client.MockClientHttpResponse;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class HttpModelPredictionClientTest {

  private static final String MODEL_URL = "http://localhost:9003";

  private MockRestServiceServer server;
  private HttpModelPredictionClient client;

  @BeforeEach
  void setUp() {
    RestClient.Builder builder =
        RestClient.builder()
            .baseUrl(MODEL_URL)
            .requestFactory(new SimpleClientHttpRequestFactory());

    ObjectMapper mapper =
        JsonMapper.builder().propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE).build();

    builder.messageConverters(
        converters -> {
          converters.removeIf(MappingJackson2HttpMessageConverter.class::isInstance);
          converters.add(new MappingJackson2HttpMessageConverter(mapper));
        });

    server = MockRestServiceServer.bindTo(builder).build();
    client = new HttpModelPredictionClient(builder.build());
  }

  @Test
  void sendsOneBatchRequestAndPreservesPredictionOrder() {
    server
        .expect(requestTo(MODEL_URL + "/api/v1/properties/predict"))
        .andExpect(method(HttpMethod.POST))
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
                """
                        {"count":2,"predictions":[420000,465000]}
                        """,
                MediaType.APPLICATION_JSON));

    assertThat(client.predict(features()))
        .containsExactly(new BigDecimal("420000"), new BigDecimal("465000"));

    server.verify();
  }

  @Test
  void acceptsPredictionCountMatchingSingleInput() {
    server
        .expect(requestTo(MODEL_URL + "/api/v1/properties/predict"))
        .andRespond(
            withSuccess("{\"count\":1,\"predictions\":[420000]}", MediaType.APPLICATION_JSON));

    assertThat(client.predict(List.of(features().getFirst())))
        .containsExactly(new BigDecimal("420000"));

    server.verify();
  }

  @Test
  void rejectsPredictionCountThatOverflowsAnInteger() {
    server
        .expect(requestTo(MODEL_URL + "/api/v1/properties/predict"))
        .andRespond(
            withSuccess(
                "{\"count\":4294967298,\"predictions\":[420000,465000]}",
                MediaType.APPLICATION_JSON));

    assertProblem(HttpStatus.BAD_GATEWAY);
    server.verify();
  }

  @Test
  void mapsModelHttpErrorToBadGateway() {
    server
        .expect(requestTo(MODEL_URL + "/api/v1/properties/predict"))
        .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

    assertProblem(HttpStatus.BAD_GATEWAY);
    server.verify();
  }

  @Test
  void rejectsNonOkSuccessStatusFromModel() {
    server
        .expect(requestTo(MODEL_URL + "/api/v1/properties/predict"))
        .andRespond(
            withStatus(HttpStatus.CREATED)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"count\":2,\"predictions\":[420000,465000]}"));

    assertProblem(HttpStatus.BAD_GATEWAY);
    server.verify();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{\"count\":1,\"predictions\":[420000,465000]}",
        "{\"count\":2,\"predictions\":[420000]}",
        "{\"count\":2,\"predictions\":[420000,\"bad\"]}"
      })
  void rejectsInvalidPredictionStructure(String body) {
    server
        .expect(requestTo(MODEL_URL + "/api/v1/properties/predict"))
        .andRespond(withSuccess(body, MediaType.APPLICATION_JSON));

    assertProblem(HttpStatus.BAD_GATEWAY);
    server.verify();
  }

  @Test
  void mapsMalformedJsonToBadGateway() {
    server
        .expect(requestTo(MODEL_URL + "/api/v1/properties/predict"))
        .andRespond(withSuccess("{not-json", MediaType.APPLICATION_JSON));

    assertProblem(HttpStatus.BAD_GATEWAY);
    server.verify();
  }

  @Test
  void mapsConnectionFailureAndTimeoutToServiceUnavailable() {
    assertTransportProblem(new IOException("connection refused"));
    assertTransportProblem(new SocketTimeoutException("read timed out"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "{\"count\":2,\"predictions\":["})
  void mapsResponseBodyTimeoutToServiceUnavailable(String bodyPrefix) {
    server
        .expect(requestTo(MODEL_URL + "/api/v1/properties/predict"))
        .andRespond(
            request -> {
              InputStream body =
                  new InputStream() {
                    private int position;

                    @Override
                    public int read() throws IOException {
                      if (position < bodyPrefix.length()) {
                        return bodyPrefix.charAt(position++);
                      }
                      throw new SocketTimeoutException("private upstream detail");
                    }
                  };
              MockClientHttpResponse response = new MockClientHttpResponse(body, HttpStatus.OK);
              response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
              return response;
            });

    assertProblem(HttpStatus.SERVICE_UNAVAILABLE);
    server.verify();
  }

  private void assertProblem(HttpStatus expectedStatus) {
    assertThatThrownBy(() -> client.predict(features()))
        .isInstanceOfSatisfying(
            ApiException.class,
            problem -> {
              assertThat(problem.status()).isEqualTo(expectedStatus);
              assertThat(problem.getMessage()).doesNotContain("private upstream detail");
            });
  }

  private void assertTransportProblem(IOException failure) {
    ClientHttpRequestFactory failingFactory =
        (uri, method) -> {
          throw failure;
        };

    RestClient restClient =
        RestClient.builder().baseUrl(MODEL_URL).requestFactory(failingFactory).build();

    HttpModelPredictionClient failingClient = new HttpModelPredictionClient(restClient);

    assertThatThrownBy(() -> failingClient.predict(features()))
        .isInstanceOfSatisfying(
            ApiException.class,
            problem -> assertThat(problem.status()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
  }

  private List<HousingFeatures> features() {
    return List.of(
        new HousingFeatures(
            1550,
            3,
            new BigDecimal("2.0"),
            1997,
            6800,
            new BigDecimal("4.1"),
            new BigDecimal("7.6")),
        new HousingFeatures(
            1800,
            3,
            new BigDecimal("2.0"),
            1997,
            6800,
            new BigDecimal("4.1"),
            new BigDecimal("7.6")));
  }
}
