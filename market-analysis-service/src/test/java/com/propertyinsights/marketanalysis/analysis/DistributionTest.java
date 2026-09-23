package com.propertyinsights.marketanalysis.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import com.propertyinsights.marketanalysis.property.PropertyRecord;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.util.LinkedMultiValueMap;

class DistributionTest {

    @Test
    void cutPointsBelongToUpperBucket() {
        var rows =
                List.of(
                        property(1, 2, "1.0", 199999),
                        property(2, 2, "1.0", 200000),
                        property(3, 2, "1.0", 249999),
                        property(4, 2, "1.0", 250000));

        DistributionResponse result =
                service(rows)
                        .distribution(SegmentFilter.unrestricted(), DistributionDimension.PRICE);

        assertThat(result.buckets())
                .extracting(DistributionBucket::count)
                .containsExactly(1, 2, 1, 0, 0);
        assertThat(result.buckets())
                .extracting(DistributionBucket::key)
                .containsExactly(
                        "lt_200000",
                        "200000_to_250000",
                        "250000_to_300000",
                        "300000_to_350000",
                        "gte_350000");
    }

    @ParameterizedTest(name = "{0} cut points belong to the upper bucket")
    @MethodSource("rangeDimensionsAndCutPoints")
    void everyRangeCutPointBelongsToTheUpperBucket(
            DistributionDimension dimension,
            List<BigDecimal> cutPoints,
            List<Integer> expectedBucketCounts) {
        BigDecimal step = stepFor(dimension);
        var rows = new ArrayList<PropertyRecord>();
        long id = 1;

        for (BigDecimal cutPoint : cutPoints) {
            rows.add(propertyWithDimensionValue(id++, dimension, cutPoint.subtract(step)));
            rows.add(propertyWithDimensionValue(id++, dimension, cutPoint));
        }

        DistributionResponse result =
                service(rows).distribution(SegmentFilter.unrestricted(), dimension);

        assertThat(result.matchedCount()).isEqualTo(rows.size());
        assertThat(result.buckets())
                .extracting(DistributionBucket::count)
                .containsExactlyElementsOf(expectedBucketCounts);
    }

    @Test
    void zeroCountBucketsRemainAndHaveNullAveragePrice() {
        var rows =
                List.of(
                        property(1, 2, "1.0", 199999),
                        property(2, 2, "1.0", 200000),
                        property(3, 2, "1.0", 249999),
                        property(4, 2, "1.0", 250000));

        var params = new LinkedMultiValueMap<String, String>();
        params.add("min_price", "199999");
        params.add("max_price", "199999");

        DistributionResponse result =
                service(rows)
                        .distribution(
                                new SegmentFilterParser().parse(params),
                                DistributionDimension.PRICE);

        assertThat(result.matchedCount()).isEqualTo(1);
        assertThat(result.buckets()).hasSize(5);
        assertThat(result.buckets().getFirst().averagePrice()).isEqualByComparingTo("199999.00");
        assertThat(result.buckets().get(1).averagePrice()).isNull();
        assertThat(result.buckets().get(2).averagePrice()).isNull();
        assertThat(result.buckets().get(3).averagePrice()).isNull();
        assertThat(result.buckets().get(4).averagePrice()).isNull();
    }

    @Test
    void bedroomAndBathroomBucketsComeFromTheFullDataset() {
        var rows =
                List.of(
                        property(1, 2, "1.0", 190000),
                        property(2, 3, "2.0", 220000),
                        property(3, 4, "2.5", 280000));

        var params = new LinkedMultiValueMap<String, String>();
        params.add("min_price", "250000");
        SegmentFilter filter = new SegmentFilterParser().parse(params);
        MarketAnalysisService service = service(rows);

        DistributionResponse bedrooms =
                service.distribution(filter, DistributionDimension.BEDROOMS);
        DistributionResponse bathrooms =
                service.distribution(filter, DistributionDimension.BATHROOMS);

        assertThat(bedrooms.buckets())
                .extracting(DistributionBucket::label)
                .containsExactly("2", "3", "4");
        assertThat(bedrooms.buckets())
                .extracting(DistributionBucket::count)
                .containsExactly(0, 0, 1);

        assertThat(bathrooms.buckets())
                .extracting(DistributionBucket::label)
                .containsExactly("1", "2", "2.5");
        assertThat(bathrooms.buckets())
                .extracting(DistributionBucket::count)
                .containsExactly(0, 0, 1);
    }

    private static MarketAnalysisService service(List<PropertyRecord> rows) {
        return new MarketAnalysisService(() -> List.copyOf(rows));
    }

    private static PropertyRecord property(long id, int bedrooms, String bathrooms, int price) {
        return new PropertyRecord(
                id,
                1200,
                bedrooms,
                new BigDecimal(bathrooms),
                1985,
                5200,
                new BigDecimal("3.2"),
                new BigDecimal("7.1"),
                BigDecimal.valueOf(price));
    }

    private static Stream<Arguments> rangeDimensionsAndCutPoints() {
        return Stream.of(
                Arguments.of(
                        DistributionDimension.PRICE,
                        List.of(
                                new BigDecimal("200000"),
                                new BigDecimal("250000"),
                                new BigDecimal("300000"),
                                new BigDecimal("350000")),
                        List.of(1, 2, 2, 2, 1)),
                Arguments.of(
                        DistributionDimension.SQUARE_FOOTAGE,
                        List.of(
                                new BigDecimal("1200"),
                                new BigDecimal("1600"),
                                new BigDecimal("2000")),
                        List.of(1, 2, 2, 1)),
                Arguments.of(
                        DistributionDimension.YEAR_BUILT,
                        List.of(
                                new BigDecimal("1980"),
                                new BigDecimal("1990"),
                                new BigDecimal("2000"),
                                new BigDecimal("2010")),
                        List.of(1, 2, 2, 2, 1)),
                Arguments.of(
                        DistributionDimension.LOT_SIZE,
                        List.of(
                                new BigDecimal("6000"),
                                new BigDecimal("8000"),
                                new BigDecimal("10000")),
                        List.of(1, 2, 2, 1)),
                Arguments.of(
                        DistributionDimension.DISTANCE_TO_CITY_CENTER,
                        List.of(new BigDecimal("3"), new BigDecimal("5"), new BigDecimal("7")),
                        List.of(1, 2, 2, 1)),
                Arguments.of(
                        DistributionDimension.SCHOOL_RATING,
                        List.of(new BigDecimal("7"), new BigDecimal("8"), new BigDecimal("9")),
                        List.of(1, 2, 2, 1)));
    }

    private static BigDecimal stepFor(DistributionDimension dimension) {
        return switch (dimension) {
            case PRICE, SQUARE_FOOTAGE, YEAR_BUILT, LOT_SIZE -> BigDecimal.ONE;
            case DISTANCE_TO_CITY_CENTER, SCHOOL_RATING -> new BigDecimal("0.1");
            case BEDROOMS, BATHROOMS ->
                    throw new IllegalArgumentException(
                            "Discrete dimensions do not have range cut points.");
        };
    }

    private static PropertyRecord propertyWithDimensionValue(
            long id, DistributionDimension dimension, BigDecimal value) {
        int squareFootage = 1200;
        int yearBuilt = 1985;
        int lotSize = 5200;
        BigDecimal distanceToCityCenter = new BigDecimal("3.2");
        BigDecimal schoolRating = new BigDecimal("7.1");
        BigDecimal price = new BigDecimal("100000");

        switch (dimension) {
            case PRICE -> price = value;
            case SQUARE_FOOTAGE -> squareFootage = value.intValueExact();
            case YEAR_BUILT -> yearBuilt = value.intValueExact();
            case LOT_SIZE -> lotSize = value.intValueExact();
            case DISTANCE_TO_CITY_CENTER -> distanceToCityCenter = value;
            case SCHOOL_RATING -> schoolRating = value;
            case BEDROOMS, BATHROOMS ->
                    throw new IllegalArgumentException(
                            "Discrete dimensions do not have range cut points.");
        }

        return new PropertyRecord(
                id,
                squareFootage,
                2,
                new BigDecimal("1.0"),
                yearBuilt,
                lotSize,
                distanceToCityCenter,
                schoolRating,
                price);
    }
}
