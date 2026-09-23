package com.propertyinsights.marketanalysis.impact;

import java.math.BigDecimal;
import java.util.function.Function;

enum HousingFeature {
    SQUARE_FOOTAGE("square_footage", features -> BigDecimal.valueOf(features.squareFootage())),
    BEDROOMS("bedrooms", features -> BigDecimal.valueOf(features.bedrooms())),
    BATHROOMS("bathrooms", HousingFeatures::bathrooms),
    YEAR_BUILT("year_built", features -> BigDecimal.valueOf(features.yearBuilt())),
    LOT_SIZE("lot_size", features -> BigDecimal.valueOf(features.lotSize())),
    DISTANCE_TO_CITY_CENTER("distance_to_city_center", HousingFeatures::distanceToCityCenter),
    SCHOOL_RATING("school_rating", HousingFeatures::schoolRating);

    private final String jsonName;
    private final Function<HousingFeatures, BigDecimal> value;

    HousingFeature(String jsonName, Function<HousingFeatures, BigDecimal> value) {
        this.jsonName = jsonName;
        this.value = value;
    }

    String jsonName() {
        return jsonName;
    }

    BigDecimal valueOf(HousingFeatures features) {
        return value.apply(features);
    }

    static boolean contains(String jsonName) {
        for (HousingFeature feature : values()) {
            if (feature.jsonName.equals(jsonName)) {
                return true;
            }
        }

        return false;
    }
}
