package com.propertyinsights.marketanalysis.analysis;

import com.fasterxml.jackson.annotation.JsonValue;
import com.propertyinsights.marketanalysis.error.ApiException;
import java.util.Arrays;
import org.springframework.http.HttpStatus;

public enum DistributionDimension {
    PRICE("price"),
    SQUARE_FOOTAGE("square_footage"),
    BEDROOMS("bedrooms"),
    BATHROOMS("bathrooms"),
    YEAR_BUILT("year_built"),
    LOT_SIZE("lot_size"),
    DISTANCE_TO_CITY_CENTER("distance_to_city_center"),
    SCHOOL_RATING("school_rating");

    private final String path;

    DistributionDimension(String path) {
        this.path = path;
    }

    @JsonValue
    public String path() {
        return path;
    }

    public static DistributionDimension fromPath(String path) {
        return Arrays.stream(values())
                .filter(dimension -> dimension.path.equals(path))
                .findFirst()
                .orElseThrow(
                        () ->
                                new ApiException(
                                        HttpStatus.BAD_REQUEST,
                                        "Unsupported distribution dimension."));
    }
}
