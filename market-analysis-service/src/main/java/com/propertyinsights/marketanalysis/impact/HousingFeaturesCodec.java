package com.propertyinsights.marketanalysis.impact;

import com.fasterxml.jackson.databind.JsonNode;
import com.propertyinsights.marketanalysis.error.ApiException;
import com.propertyinsights.marketanalysis.property.FeatureBounds;
import java.math.BigDecimal;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public final class HousingFeaturesCodec {

  public HousingFeatures parse(JsonNode node) {
    if (node == null || !node.isObject() || node.size() != HousingFeature.values().length) {
      throw invalidRequest();
    }

    for (HousingFeature feature : HousingFeature.values()) {
      if (!node.has(feature.jsonName())) {
        throw invalidRequest();
      }
    }

    int squareFootage = integer(node, HousingFeature.SQUARE_FOOTAGE.jsonName());
    int bedrooms = integer(node, HousingFeature.BEDROOMS.jsonName());
    BigDecimal bathrooms = decimal(node, HousingFeature.BATHROOMS.jsonName());
    int yearBuilt = integer(node, HousingFeature.YEAR_BUILT.jsonName());
    int lotSize = integer(node, HousingFeature.LOT_SIZE.jsonName());
    BigDecimal distanceToCityCenter =
        decimal(node, HousingFeature.DISTANCE_TO_CITY_CENTER.jsonName());
    BigDecimal schoolRating = decimal(node, HousingFeature.SCHOOL_RATING.jsonName());

    try {
      FeatureBounds.validate(
          squareFootage,
          bedrooms,
          bathrooms,
          yearBuilt,
          lotSize,
          distanceToCityCenter,
          schoolRating);
    } catch (IllegalArgumentException exception) {
      throw invalidRequest();
    }

    return new HousingFeatures(
        squareFootage, bedrooms, bathrooms, yearBuilt, lotSize, distanceToCityCenter, schoolRating);
  }

  private int integer(JsonNode object, String field) {
    JsonNode value = numericValue(object, field);

    try {
      return value.decimalValue().intValueExact();
    } catch (ArithmeticException | NumberFormatException exception) {
      throw invalidRequest();
    }
  }

  private BigDecimal decimal(JsonNode object, String field) {
    JsonNode value = numericValue(object, field);

    try {
      return value.decimalValue();
    } catch (ArithmeticException | NumberFormatException exception) {
      throw invalidRequest();
    }
  }

  private JsonNode numericValue(JsonNode object, String field) {
    JsonNode value = object.get(field);

    if (value == null || !value.isNumber() || !Double.isFinite(value.doubleValue())) {
      throw invalidRequest();
    }

    return value;
  }

  private ApiException invalidRequest() {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid price impact request.");
  }
}
