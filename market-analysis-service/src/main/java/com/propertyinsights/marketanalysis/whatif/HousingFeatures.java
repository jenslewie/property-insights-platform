package com.propertyinsights.marketanalysis.whatif;

import java.math.BigDecimal;

public record HousingFeatures(
        int squareFootage,
        int bedrooms,
        BigDecimal bathrooms,
        int yearBuilt,
        int lotSize,
        BigDecimal distanceToCityCenter,
        BigDecimal schoolRating) {}
