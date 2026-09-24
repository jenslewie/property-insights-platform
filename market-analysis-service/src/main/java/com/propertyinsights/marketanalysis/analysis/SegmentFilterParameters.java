package com.propertyinsights.marketanalysis.analysis;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Schema;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Documents the named query parameters parsed by {@link SegmentFilterParser}. */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Operation(
    description =
        "Filter properties using optional, inclusive minimum and maximum bounds."
            + " All supplied bounds are combined with AND; omitting all filters uses"
            + " the complete dataset. Each parameter may occur only once."
            + " Unknown parameters, blank or nonnumeric values, fractional values for"
            + " integer fields, and a minimum greater than its maximum return HTTP 400.")
@Parameters({
  @Parameter(
      name = "min_square_footage",
      in = ParameterIn.QUERY,
      description =
          "Inclusive minimum floor area in square feet. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "integer"),
      example = "1200"),
  @Parameter(
      name = "max_square_footage",
      in = ParameterIn.QUERY,
      description =
          "Inclusive maximum floor area in square feet. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "integer"),
      example = "2000"),
  @Parameter(
      name = "min_bedrooms",
      in = ParameterIn.QUERY,
      description = "Inclusive minimum number of bedrooms. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "integer"),
      example = "2"),
  @Parameter(
      name = "max_bedrooms",
      in = ParameterIn.QUERY,
      description = "Inclusive maximum number of bedrooms. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "integer"),
      example = "4"),
  @Parameter(
      name = "min_bathrooms",
      in = ParameterIn.QUERY,
      description = "Inclusive minimum number of bathrooms. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "number"),
      example = "1.5"),
  @Parameter(
      name = "max_bathrooms",
      in = ParameterIn.QUERY,
      description = "Inclusive maximum number of bathrooms. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "number"),
      example = "2.5"),
  @Parameter(
      name = "min_year_built",
      in = ParameterIn.QUERY,
      description = "Inclusive minimum construction year. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "integer"),
      example = "1980"),
  @Parameter(
      name = "max_year_built",
      in = ParameterIn.QUERY,
      description = "Inclusive maximum construction year. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "integer"),
      example = "2020"),
  @Parameter(
      name = "min_lot_size",
      in = ParameterIn.QUERY,
      description = "Inclusive minimum lot size. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "integer"),
      example = "5000"),
  @Parameter(
      name = "max_lot_size",
      in = ParameterIn.QUERY,
      description = "Inclusive maximum lot size. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "integer"),
      example = "9000"),
  @Parameter(
      name = "min_distance_to_city_center",
      in = ParameterIn.QUERY,
      description =
          "Inclusive minimum distance to the city center. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "number"),
      example = "2"),
  @Parameter(
      name = "max_distance_to_city_center",
      in = ParameterIn.QUERY,
      description =
          "Inclusive maximum distance to the city center. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "number"),
      example = "8"),
  @Parameter(
      name = "min_school_rating",
      in = ParameterIn.QUERY,
      description = "Inclusive minimum school rating. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "number"),
      example = "6"),
  @Parameter(
      name = "max_school_rating",
      in = ParameterIn.QUERY,
      description = "Inclusive maximum school rating. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "number"),
      example = "9"),
  @Parameter(
      name = "min_price",
      in = ParameterIn.QUERY,
      description = "Inclusive minimum property price. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "number"),
      example = "200000"),
  @Parameter(
      name = "max_price",
      in = ParameterIn.QUERY,
      description = "Inclusive maximum property price. Omit to leave this bound unrestricted.",
      schema = @Schema(type = "number"),
      example = "300000")
})
public @interface SegmentFilterParameters {}
