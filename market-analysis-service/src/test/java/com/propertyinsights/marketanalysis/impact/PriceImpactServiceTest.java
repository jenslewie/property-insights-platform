package com.propertyinsights.marketanalysis.impact;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.propertyinsights.marketanalysis.analysis.SegmentFilterParser;
import com.propertyinsights.marketanalysis.config.MarketSettings;
import com.propertyinsights.marketanalysis.error.ApiException;
import com.propertyinsights.marketanalysis.property.PropertyDataset;
import com.propertyinsights.marketanalysis.property.PropertyRecord;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class PriceImpactServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final List<List<HousingFeatures>> calls = new ArrayList<>();
    private List<BigDecimal> predictions;
    private Function<List<HousingFeatures>, List<BigDecimal>> predictionFunction =
            features -> predictions;

    private final ModelPredictionClient client =
            features -> {
                calls.add(List.copyOf(features));
                return predictionFunction.apply(features);
            };

    @Test
    void comparesMarketMetricsForFilteredPropertiesInPairedOrder() throws Exception {
        predictions =
                List.of(
                        new BigDecimal("900"),
                        new BigDecimal("1000"),
                        new BigDecimal("1000"),
                        new BigDecimal("1100"));
        PriceImpactService service =
                service(
                        List.of(property(1, 2, "8"), property(2, 3, "9"), property(3, 3, "10")),
                        20);

        PriceImpactResponse result =
                service.compare(
                        mapper.readTree("{\"min_bedrooms\":3}"),
                        mapper.readTree("{\"school_rating_delta\":1}"));

        assertThat(calls)
                .containsExactly(
                        List.of(
                                features(1200, 3, "9"),
                                features(1200, 3, "10"),
                                features(1300, 3, "10"),
                                features(1300, 3, "11")));
        assertThat(result.propertyCount()).isEqualTo(2);
        assertThat(result.baseline())
                .isEqualTo(
                        new PriceImpactResponse.PriceMetrics(
                                new BigDecimal("950.00"),
                                new BigDecimal("950.00"),
                                new BigDecimal("900.00"),
                                new BigDecimal("1000.00")));
        assertThat(result.scenario().mean()).isEqualByComparingTo("1050.00");
        assertThat(result.impact().mean().absoluteChange()).isEqualByComparingTo("100.00");
        assertThat(result.impact().mean().percentageChange()).isEqualByComparingTo("10.53");
    }

    @Test
    void batchesByWholePropertyPairsWithinModelLimit() throws Exception {
        List<PropertyRecord> properties = new ArrayList<>();
        for (int index = 0; index < 50; index++) {
            properties.add(property(index + 1L, 3, Integer.toString(1 + index % 10), 1000 + index));
        }
        PriceImpactService service = service(properties, 20);
        predictionFunction =
                features ->
                        features.stream()
                                .map(item -> BigDecimal.valueOf(item.squareFootage()))
                                .toList();

        PriceImpactResponse result =
                service.compare(
                        mapper.readTree("{}"), mapper.readTree("{\"school_rating_delta\":1}"));

        assertThat(result.propertyCount()).isEqualTo(50);
        assertThat(calls).hasSize(5);
        assertThat(calls).allSatisfy(batch -> assertThat(batch).hasSize(20));
        assertThat(calls.getFirst().get(0).squareFootage()).isEqualTo(1000);
        assertThat(calls.getFirst().get(1).squareFootage()).isEqualTo(1000);
        assertThat(calls.getFirst().get(2).squareFootage()).isEqualTo(1001);
        assertThat(calls.getLast().get(18).squareFootage()).isEqualTo(1049);
    }

    @Test
    void rejectsEmptySegmentNoOpAndInvalidScenarioBeforeModelCalls() throws Exception {
        predictions = List.of(new BigDecimal("10"), new BigDecimal("20"));
        PriceImpactService service = service(List.of(property(1, 3, "8")), 20);

        assertProblem(
                service,
                mapper.readTree("{\"min_bedrooms\":9}"),
                mapper.readTree("{\"school_rating_delta\":1}"),
                HttpStatus.UNPROCESSABLE_ENTITY);
        assertProblem(
                service,
                mapper.readTree("{}"),
                mapper.readTree("{\"school_rating_delta\":0}"),
                HttpStatus.UNPROCESSABLE_ENTITY);
        assertProblem(
                service,
                mapper.readTree("{}"),
                mapper.readTree("{\"school_rating_delta\":20}"),
                HttpStatus.UNPROCESSABLE_ENTITY);
        assertProblem(
                service,
                mapper.readTree("{\"max_bedrooms\":\"4\"}"),
                mapper.readTree("{\"school_rating_delta\":1}"),
                HttpStatus.UNPROCESSABLE_ENTITY);

        assertThat(calls).isEmpty();
    }

    @Test
    void rejectsModelResponseWithWrongCountOrNullPrediction() throws Exception {
        predictions = List.of(new BigDecimal("10"));
        PriceImpactService service = service(List.of(property(1, 3, "8")), 20);
        assertProblem(
                service,
                mapper.readTree("{}"),
                mapper.readTree("{\"school_rating_delta\":1}"),
                HttpStatus.BAD_GATEWAY);

        predictions = java.util.Arrays.asList(new BigDecimal("10"), null);
        assertProblem(
                service,
                mapper.readTree("{}"),
                mapper.readTree("{\"school_rating_delta\":1}"),
                HttpStatus.BAD_GATEWAY);
    }

    private PriceImpactService service(List<PropertyRecord> properties, int batchLimit) {
        PropertyDataset dataset = () -> properties;
        MarketSettings settings =
                new MarketSettings("data.csv", "http://localhost", 5, 100, batchLimit);
        return new PriceImpactService(dataset, new SegmentFilterParser(), client, settings);
    }

    private PropertyRecord property(long id, int bedrooms, String schoolRating) {
        return property(id, bedrooms, schoolRating, 1000 + (int) id * 100);
    }

    private PropertyRecord property(long id, int bedrooms, String schoolRating, int squareFootage) {
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

    private HousingFeatures features(int squareFootage, int bedrooms, String schoolRating) {
        return new HousingFeatures(
                squareFootage,
                bedrooms,
                new BigDecimal("2.0"),
                1997,
                6800,
                new BigDecimal("4.1"),
                new BigDecimal(schoolRating));
    }

    private void assertProblem(
            PriceImpactService service,
            JsonNode filters,
            JsonNode adjustments,
            HttpStatus expectedStatus) {
        assertThatThrownBy(() -> service.compare(filters, adjustments))
                .isInstanceOfSatisfying(
                        ApiException.class,
                        problem -> assertThat(problem.status()).isEqualTo(expectedStatus));
    }
}
