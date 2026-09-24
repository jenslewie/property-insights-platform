package com.propertyinsights.marketanalysis.impact;

import com.fasterxml.jackson.databind.JsonNode;
import com.propertyinsights.marketanalysis.error.ApiException;
import com.propertyinsights.marketanalysis.property.FeatureBounds;
import com.propertyinsights.marketanalysis.property.PropertyRecord;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Iterator;
import java.util.Map;
import org.springframework.http.HttpStatus;

public record ScenarioAdjustments(BigDecimal schoolRatingDelta, BigDecimal squareFootagePercent) {

    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    public static ScenarioAdjustments parse(JsonNode node) {
        if (node == null || !node.isObject() || node.isEmpty()) {
            throw invalidRequest();
        }

        BigDecimal schoolRatingDelta = null;
        BigDecimal squareFootagePercent = null;
        Iterator<Map.Entry<String, JsonNode>> fields = node.fields();

        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> field = fields.next();
            BigDecimal value = finiteDecimal(field.getValue());
            switch (field.getKey()) {
                case "school_rating_delta" -> schoolRatingDelta = value;
                case "square_footage_percent" -> squareFootagePercent = value;
                default -> throw invalidRequest();
            }
        }

        return new ScenarioAdjustments(schoolRatingDelta, squareFootagePercent);
    }

    public HousingFeatures apply(HousingFeatures baseline) {
        int squareFootage = adjustedSquareFootage(baseline.squareFootage());
        BigDecimal schoolRating = baseline.schoolRating();
        if (schoolRatingDelta != null) {
            schoolRating = schoolRating.add(schoolRatingDelta);
        }

        try {
            FeatureBounds.validate(
                    squareFootage,
                    baseline.bedrooms(),
                    baseline.bathrooms(),
                    baseline.yearBuilt(),
                    baseline.lotSize(),
                    baseline.distanceToCityCenter(),
                    schoolRating);
        } catch (IllegalArgumentException | ArithmeticException exception) {
            throw invalidRequest();
        }

        return new HousingFeatures(
                squareFootage,
                baseline.bedrooms(),
                baseline.bathrooms(),
                baseline.yearBuilt(),
                baseline.lotSize(),
                baseline.distanceToCityCenter(),
                schoolRating);
    }

    public HousingFeatures apply(PropertyRecord property) {
        return apply(
                new HousingFeatures(
                        property.squareFootage(),
                        property.bedrooms(),
                        property.bathrooms(),
                        property.yearBuilt(),
                        property.lotSize(),
                        property.distanceToCityCenter(),
                        property.schoolRating()));
    }

    public boolean hasEffectiveAdjustment() {
        return (schoolRatingDelta != null && schoolRatingDelta.compareTo(BigDecimal.ZERO) != 0)
                || (squareFootagePercent != null
                        && squareFootagePercent.compareTo(BigDecimal.ZERO) != 0);
    }

    private int adjustedSquareFootage(int squareFootage) {
        if (squareFootagePercent == null || squareFootagePercent.compareTo(BigDecimal.ZERO) == 0) {
            return squareFootage;
        }

        try {
            return BigDecimal.valueOf(squareFootage)
                    .multiply(ONE_HUNDRED.add(squareFootagePercent))
                    .divide(ONE_HUNDRED, 0, RoundingMode.HALF_UP)
                    .intValueExact();
        } catch (ArithmeticException exception) {
            throw invalidRequest();
        }
    }

    private static BigDecimal finiteDecimal(JsonNode value) {
        if (value == null || !value.isNumber() || !Double.isFinite(value.doubleValue())) {
            throw invalidRequest();
        }

        try {
            return value.decimalValue();
        } catch (ArithmeticException | NumberFormatException exception) {
            throw invalidRequest();
        }
    }

    private static ApiException invalidRequest() {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid price impact request.");
    }
}
