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

public record ScenarioAdjustments(
    BigDecimal schoolRatingDelta,
    BigDecimal squareFootagePercent,
    BigDecimal bedroomsDelta,
    BigDecimal bathroomsDelta,
    BigDecimal yearBuiltDelta,
    BigDecimal lotSizeDelta,
    BigDecimal distanceToCityCenterDelta) {

  private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

  public static ScenarioAdjustments parse(JsonNode node) {
    if (node == null || !node.isObject() || node.isEmpty()) {
      throw invalidRequest();
    }

    BigDecimal schoolRatingDelta = null;
    BigDecimal squareFootagePercent = null;
    BigDecimal bedroomsDelta = null;
    BigDecimal bathroomsDelta = null;
    BigDecimal yearBuiltDelta = null;
    BigDecimal lotSizeDelta = null;
    BigDecimal distanceToCityCenterDelta = null;
    Iterator<Map.Entry<String, JsonNode>> fields = node.fields();

    while (fields.hasNext()) {
      Map.Entry<String, JsonNode> field = fields.next();
      BigDecimal value = finiteDecimal(field.getValue());
      switch (field.getKey()) {
        case "school_rating_delta" -> schoolRatingDelta = value;
        case "square_footage_percent" -> squareFootagePercent = value;
        case "bedrooms_delta" -> bedroomsDelta = integer(value);
        case "bathrooms_delta" -> bathroomsDelta = value;
        case "year_built_delta" -> yearBuiltDelta = integer(value);
        case "lot_size_delta" -> lotSizeDelta = integer(value);
        case "distance_to_city_center_delta" -> distanceToCityCenterDelta = value;
        default -> throw invalidRequest();
      }
    }

    return new ScenarioAdjustments(
        schoolRatingDelta,
        squareFootagePercent,
        bedroomsDelta,
        bathroomsDelta,
        yearBuiltDelta,
        lotSizeDelta,
        distanceToCityCenterDelta);
  }

  public HousingFeatures apply(HousingFeatures baseline) {
    int squareFootage = adjustedSquareFootage(baseline.squareFootage());
    int bedrooms = adjustedInteger(baseline.bedrooms(), bedroomsDelta);
    BigDecimal bathrooms = adjustedDecimal(baseline.bathrooms(), bathroomsDelta);
    int yearBuilt = adjustedInteger(baseline.yearBuilt(), yearBuiltDelta);
    int lotSize = adjustedInteger(baseline.lotSize(), lotSizeDelta);
    BigDecimal distanceToCityCenter =
        adjustedDecimal(baseline.distanceToCityCenter(), distanceToCityCenterDelta);
    BigDecimal schoolRating = adjustedDecimal(baseline.schoolRating(), schoolRatingDelta);

    try {
      FeatureBounds.validate(
          squareFootage,
          bedrooms,
          bathrooms,
          yearBuilt,
          lotSize,
          distanceToCityCenter,
          schoolRating);
    } catch (IllegalArgumentException | ArithmeticException exception) {
      throw invalidRequest();
    }

    return new HousingFeatures(
        squareFootage, bedrooms, bathrooms, yearBuilt, lotSize, distanceToCityCenter, schoolRating);
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
        || (squareFootagePercent != null && squareFootagePercent.compareTo(BigDecimal.ZERO) != 0)
        || (bedroomsDelta != null && bedroomsDelta.compareTo(BigDecimal.ZERO) != 0)
        || (bathroomsDelta != null && bathroomsDelta.compareTo(BigDecimal.ZERO) != 0)
        || (yearBuiltDelta != null && yearBuiltDelta.compareTo(BigDecimal.ZERO) != 0)
        || (lotSizeDelta != null && lotSizeDelta.compareTo(BigDecimal.ZERO) != 0)
        || (distanceToCityCenterDelta != null
            && distanceToCityCenterDelta.compareTo(BigDecimal.ZERO) != 0);
  }

  private static int adjustedInteger(int baseline, BigDecimal delta) {
    if (delta == null) {
      return baseline;
    }
    try {
      return Math.addExact(baseline, delta.intValueExact());
    } catch (ArithmeticException exception) {
      throw invalidRequest();
    }
  }

  private static BigDecimal adjustedDecimal(BigDecimal baseline, BigDecimal delta) {
    return delta == null ? baseline : baseline.add(delta);
  }

  private static BigDecimal integer(BigDecimal value) {
    try {
      value.intValueExact();
      return value;
    } catch (ArithmeticException exception) {
      throw invalidRequest();
    }
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
