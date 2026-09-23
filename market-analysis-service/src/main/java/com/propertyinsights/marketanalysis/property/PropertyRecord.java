package com.propertyinsights.marketanalysis.property;

import java.math.BigDecimal;

public record PropertyRecord(
        long id,
        int squareFootage,
        int bedrooms,
        BigDecimal bathrooms,
        int yearBuilt,
        int lotSize,
        BigDecimal distanceToCityCenter,
        BigDecimal schoolRating,
        BigDecimal price) {}
