package com.propertyinsights.marketanalysis.property;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Year;

public final class FeatureBounds {

  private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
  private static final BigDecimal TWENTY = new BigDecimal("20");

  private FeatureBounds() {}

  public static void validate(
      int squareFootage,
      int bedrooms,
      BigDecimal bathrooms,
      int yearBuilt,
      int lotSize,
      BigDecimal distanceToCityCenter,
      BigDecimal schoolRating) {
    validate(
        squareFootage,
        bedrooms,
        bathrooms,
        yearBuilt,
        lotSize,
        distanceToCityCenter,
        schoolRating,
        Clock.systemUTC());
  }

  static void validate(
      int squareFootage,
      int bedrooms,
      BigDecimal bathrooms,
      int yearBuilt,
      int lotSize,
      BigDecimal distanceToCityCenter,
      BigDecimal schoolRating,
      Clock clock) {
    requireRange(squareFootage, 1, 10_000, "squareFootage");
    requireRange(bedrooms, 1, 10, "bedrooms");
    requireRange(bathrooms, BigDecimal.ZERO, BigDecimal.TEN, false, true, "bathrooms");
    requireRange(yearBuilt, 1900, Year.now(clock).getValue() + 5, "yearBuilt");
    requireRange(lotSize, 1, 100_000, "lotSize");
    requireRange(
        distanceToCityCenter, BigDecimal.ZERO, ONE_HUNDRED, true, true, "distanceToCityCenter");
    requireRange(schoolRating, BigDecimal.ZERO, TWENTY, true, true, "schoolRating");
  }

  private static void requireRange(int value, int min, int max, String field) {
    if (value < min || value > max) {
      throw new IllegalArgumentException("%s must be between %d and %d".formatted(field, min, max));
    }
  }

  private static void requireRange(
      BigDecimal value,
      BigDecimal min,
      BigDecimal max,
      boolean minInclusive,
      boolean maxInclusive,
      String field) {
    if (value == null) {
      throw new IllegalArgumentException("%s must not be null".formatted(field));
    }

    int minComparison = value.compareTo(min);
    int maxComparison = value.compareTo(max);

    boolean belowMinimum = minInclusive ? minComparison < 0 : minComparison <= 0;

    boolean aboveMaximum = maxInclusive ? maxComparison > 0 : maxComparison >= 0;

    if (belowMinimum || aboveMaximum) {
      String minOperator = minInclusive ? ">=" : ">";
      String maxOperator = maxInclusive ? "<=" : "<";

      throw new IllegalArgumentException(
          "%s must satisfy %s %s and %s %s"
              .formatted(
                  field, minOperator, min.toPlainString(), maxOperator, max.toPlainString()));
    }
  }
}
