package com.propertyinsights.marketanalysis.whatif;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.propertyinsights.marketanalysis.error.ApiException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class WhatIfServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final List<List<HousingFeatures>> calls = new ArrayList<>();
    private List<BigDecimal> predictions =
            List.of(new BigDecimal("420000"), new BigDecimal("465000"));

    private final ModelPredictionClient client =
            features -> {
                calls.add(List.copyOf(features));
                return predictions;
            };

    private final WhatIfService service = new WhatIfService(new HousingFeaturesCodec(), client);

    @Test
    void comparesBaselineAndScenarioUsingOneBatchCall() {
        ObjectNode changes =
                mapper.createObjectNode()
                        .put("square_footage", 1800)
                        .put("school_rating", new BigDecimal("8.5"));

        WhatIfResponse result = service.compare(baseline(), changes);

        assertThat(calls)
                .containsExactly(
                        List.of(
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
                                        new BigDecimal("8.5"))));
        assertThat(result.changes().keySet()).containsExactly("square_footage", "school_rating");
        assertThat(result.changes().get("square_footage"))
                .isEqualTo(
                        new WhatIfResponse.FeatureChange(
                                new BigDecimal("1550"), new BigDecimal("1800")));
        assertThat(result.changes().get("school_rating"))
                .isEqualTo(
                        new WhatIfResponse.FeatureChange(
                                new BigDecimal("7.6"), new BigDecimal("8.5")));
        assertThat(result.baselineEstimate()).isEqualByComparingTo("420000.00");
        assertThat(result.scenarioEstimate()).isEqualByComparingTo("465000.00");
        assertThat(result.absoluteChange()).isEqualByComparingTo("45000.00");
        assertThat(result.percentageChange()).isEqualByComparingTo("10.71");
    }

    @Test
    void reportsEveryChangedFeatureInRequestSchemaOrder() {
        ObjectNode changes =
                mapper.createObjectNode()
                        .put("school_rating", 8.5)
                        .put("distance_to_city_center", 3.5)
                        .put("lot_size", 7000)
                        .put("year_built", 2000)
                        .put("bathrooms", 2.5)
                        .put("bedrooms", 4)
                        .put("square_footage", 1800);

        WhatIfResponse result = service.compare(baseline(), changes);

        assertThat(result.changes().keySet())
                .containsExactly(
                        "square_footage",
                        "bedrooms",
                        "bathrooms",
                        "year_built",
                        "lot_size",
                        "distance_to_city_center",
                        "school_rating");
        assertThat(result.changes())
                .containsEntry("square_footage", change("1550", "1800"))
                .containsEntry("bedrooms", change("3", "4"))
                .containsEntry("bathrooms", change("2.0", "2.5"))
                .containsEntry("year_built", change("1997", "2000"))
                .containsEntry("lot_size", change("6800", "7000"))
                .containsEntry("distance_to_city_center", change("4.1", "3.5"))
                .containsEntry("school_rating", change("7.6", "8.5"));
    }

    @Test
    void returnsNullPercentageWhenBaselineEstimateIsZero() {
        predictions = List.of(BigDecimal.ZERO, new BigDecimal("10"));

        WhatIfResponse result =
                service.compare(baseline(), mapper.createObjectNode().put("school_rating", 8.5));

        assertThat(result.baselineEstimate()).isEqualByComparingTo("0.00");
        assertThat(result.absoluteChange()).isEqualByComparingTo("10.00");
        assertThat(result.percentageChange()).isNull();
    }

    @Test
    void keepsNegativeEstimateChangesNegative() {
        predictions = List.of(new BigDecimal("465000"), new BigDecimal("420000"));

        WhatIfResponse result =
                service.compare(baseline(), mapper.createObjectNode().put("school_rating", 8.5));

        assertThat(result.absoluteChange()).isEqualByComparingTo("-45000.00");
        assertThat(result.percentageChange()).isEqualByComparingTo("-9.68");
    }

    @Test
    void rejectsNoOpChangeEvenWhenNumericScaleDiffers() {
        ObjectNode changes = mapper.createObjectNode().put("bathrooms", new BigDecimal("2"));

        assertProblem(baseline(), changes, HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(calls).isEmpty();
    }

    @Test
    void rejectsInvalidInputsBeforeCallingModel() {
        ObjectNode missingBaselineFeature = baseline();
        missingBaselineFeature.remove("year_built");
        assertProblem(missingBaselineFeature, validChanges(), HttpStatus.UNPROCESSABLE_ENTITY);

        ObjectNode nullBaselineFeature = baseline();
        nullBaselineFeature.putNull("school_rating");
        assertProblem(nullBaselineFeature, validChanges(), HttpStatus.UNPROCESSABLE_ENTITY);

        assertProblem(null, validChanges(), HttpStatus.UNPROCESSABLE_ENTITY);

        assertProblem(baseline(), mapper.createObjectNode(), HttpStatus.UNPROCESSABLE_ENTITY);

        ObjectNode nullChange = mapper.createObjectNode().putNull("school_rating");
        assertProblem(baseline(), nullChange, HttpStatus.UNPROCESSABLE_ENTITY);

        ObjectNode unknownChange = mapper.createObjectNode().put("garage_spaces", 2);
        assertProblem(baseline(), unknownChange, HttpStatus.UNPROCESSABLE_ENTITY);

        ObjectNode fractionalIntegerChange = mapper.createObjectNode().put("bedrooms", 3.5);
        assertProblem(baseline(), fractionalIntegerChange, HttpStatus.UNPROCESSABLE_ENTITY);

        ObjectNode outOfRangeChange = mapper.createObjectNode().put("square_footage", 10001);
        assertProblem(baseline(), outOfRangeChange, HttpStatus.UNPROCESSABLE_ENTITY);

        assertProblem(
                baseline(),
                mapper.createObjectNode().put("school_rating", 7.6),
                HttpStatus.UNPROCESSABLE_ENTITY);

        assertThat(calls).isEmpty();
    }

    @Test
    void rejectsModelResponseWithWrongNumberOfPrices() {
        predictions = List.of(new BigDecimal("420000"));

        assertProblem(
                baseline(),
                mapper.createObjectNode().put("school_rating", 8.5),
                HttpStatus.BAD_GATEWAY);
    }

    @Test
    void rejectsModelResponseContainingNullPrice() {
        predictions = Arrays.asList(new BigDecimal("420000"), null);

        assertProblem(
                baseline(),
                mapper.createObjectNode().put("school_rating", 8.5),
                HttpStatus.BAD_GATEWAY);
    }

    private ObjectNode baseline() {
        return mapper.createObjectNode()
                .put("square_footage", 1550)
                .put("bedrooms", 3)
                .put("bathrooms", new BigDecimal("2.0"))
                .put("year_built", 1997)
                .put("lot_size", 6800)
                .put("distance_to_city_center", new BigDecimal("4.1"))
                .put("school_rating", new BigDecimal("7.6"));
    }

    private ObjectNode validChanges() {
        return mapper.createObjectNode().put("square_footage", 1800);
    }

    private WhatIfResponse.FeatureChange change(String from, String to) {
        return new WhatIfResponse.FeatureChange(new BigDecimal(from), new BigDecimal(to));
    }

    private void assertProblem(JsonNode baseline, JsonNode changes, HttpStatus expectedStatus) {
        assertThatThrownBy(() -> service.compare(baseline, changes))
                .isInstanceOfSatisfying(
                        ApiException.class,
                        problem -> assertThat(problem.status()).isEqualTo(expectedStatus));
    }
}
