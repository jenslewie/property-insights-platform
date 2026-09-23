package com.propertyinsights.marketanalysis.impact;

import com.fasterxml.jackson.databind.JsonNode;
import com.propertyinsights.marketanalysis.error.ApiException;
import java.math.BigDecimal;
import java.net.SocketTimeoutException;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageConversionException;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
public final class HttpModelPredictionClient implements ModelPredictionClient {

    private static final Logger LOGGER = LoggerFactory.getLogger(HttpModelPredictionClient.class);

    private final RestClient restClient;

    public HttpModelPredictionClient(RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    public List<BigDecimal> predict(List<HousingFeatures> properties) {
        LOGGER.atInfo()
                .addKeyValue("event", "model_prediction_started")
                .addKeyValue("property_count", properties.size())
                .log("Model prediction request started");

        JsonNode response = requestPredictions(properties);
        List<BigDecimal> predictions = parsePredictions(response, properties.size());

        LOGGER.atInfo()
                .addKeyValue("event", "model_prediction_completed")
                .addKeyValue("prediction_count", predictions.size())
                .log("Model prediction request completed");

        return predictions;
    }

    private JsonNode requestPredictions(List<HousingFeatures> properties) {
        try {
            ResponseEntity<JsonNode> response =
                    restClient
                            .post()
                            .uri("/api/v1/properties/predict")
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(properties)
                            .retrieve()
                            .toEntity(JsonNode.class);

            if (response.getStatusCode().value() != HttpStatus.OK.value()) {
                throw invalidResponse();
            }

            return response.getBody();
        } catch (RestClientResponseException exception) {
            LOGGER.atWarn()
                    .addKeyValue("event", "model_http_error")
                    .addKeyValue("upstream_status", exception.getStatusCode().value())
                    .log("Model service returned an HTTP error");

            throw new ApiException(HttpStatus.BAD_GATEWAY, "Model service returned an error.");
        } catch (ResourceAccessException exception) {
            LOGGER.atWarn()
                    .addKeyValue("event", "model_connection_error")
                    .addKeyValue("error_type", exception.getClass().getSimpleName())
                    .log("Model service is unavailable");

            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Model service is unavailable.");
        } catch (RestClientException | HttpMessageConversionException exception) {
            if (exception.contains(SocketTimeoutException.class)) {
                LOGGER.atWarn()
                        .addKeyValue("event", "model_response_timeout")
                        .log("Model service response timed out");

                throw new ApiException(
                        HttpStatus.SERVICE_UNAVAILABLE, "Model service is unavailable.");
            }

            LOGGER.atWarn()
                    .addKeyValue("event", "model_response_unreadable")
                    .addKeyValue("error_type", exception.getClass().getSimpleName())
                    .log("Model service response could not be read");

            throw invalidResponse();
        }
    }

    private List<BigDecimal> parsePredictions(JsonNode response, int expectedCount) {
        if (response == null || !response.isObject()) {
            throw invalidResponse();
        }

        JsonNode count = response.get("count");
        JsonNode values = response.get("predictions");

        if (count == null
                || !count.isIntegralNumber()
                || !count.canConvertToInt()
                || count.intValue() != expectedCount
                || values == null
                || !values.isArray()
                || values.size() != expectedCount) {
            throw invalidResponse();
        }

        List<BigDecimal> predictions = new ArrayList<>(expectedCount);

        for (JsonNode value : values) {
            if (!value.isNumber() || !Double.isFinite(value.doubleValue())) {
                throw invalidResponse();
            }

            try {
                predictions.add(value.decimalValue());
            } catch (ArithmeticException | NumberFormatException exception) {
                throw invalidResponse();
            }
        }

        return List.copyOf(predictions);
    }

    private ApiException invalidResponse() {
        LOGGER.atWarn()
                .addKeyValue("event", "model_response_rejected")
                .log("Model service returned an invalid prediction response");

        return new ApiException(
                HttpStatus.BAD_GATEWAY, "Model service returned an invalid prediction response.");
    }
}
