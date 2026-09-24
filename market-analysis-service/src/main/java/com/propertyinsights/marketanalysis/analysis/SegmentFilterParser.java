package com.propertyinsights.marketanalysis.analysis;

import com.propertyinsights.marketanalysis.error.ApiException;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;

@Component
public final class SegmentFilterParser {

  private static final String INVALID_FILTER = "Invalid or unsupported filter parameter.";

  private static final Set<String> INTEGER_FIELDS =
      Set.of("square_footage", "bedrooms", "year_built", "lot_size");

  public SegmentFilter parse(MultiValueMap<String, String> params) {
    Map<String, BigDecimal> minimums = new LinkedHashMap<>();
    Map<String, BigDecimal> maximums = new LinkedHashMap<>();

    for (Map.Entry<String, List<String>> entry : params.entrySet()) {
      String parameter = entry.getKey();
      boolean isMinimum;

      if (parameter.startsWith("min_")) {
        isMinimum = true;
      } else if (parameter.startsWith("max_")) {
        isMinimum = false;
      } else {
        throw invalidFilter();
      }

      String field = parameter.substring(4);
      if (!SegmentFilter.FIELD_ORDER.contains(field)) {
        throw invalidFilter();
      }

      List<String> values = entry.getValue();
      if (values == null || values.size() != 1 || !StringUtils.hasText(values.getFirst())) {
        throw invalidFilter();
      }

      BigDecimal value = parseValue(field, values.getFirst());
      Map<String, BigDecimal> destination = isMinimum ? minimums : maximums;
      destination.put(field, value);
    }

    Map<String, SegmentFilter.Bounds> bounds = new LinkedHashMap<>();

    for (String field : SegmentFilter.FIELD_ORDER) {
      BigDecimal min = minimums.get(field);
      BigDecimal max = maximums.get(field);

      if (min != null && max != null && min.compareTo(max) > 0) {
        throw new ApiException(
            HttpStatus.BAD_REQUEST, "Minimum filter value must not exceed maximum.");
      }

      bounds.put(field, new SegmentFilter.Bounds(min, max));
    }

    return new SegmentFilter(bounds);
  }

  private BigDecimal parseValue(String field, String rawValue) {
    try {
      BigDecimal value = new BigDecimal(rawValue.trim()).stripTrailingZeros();

      if (INTEGER_FIELDS.contains(field) && value.scale() > 0) {
        throw invalidFilter();
      }

      return value;
    } catch (NumberFormatException | ArithmeticException exception) {
      throw invalidFilter();
    }
  }

  private ApiException invalidFilter() {
    return new ApiException(HttpStatus.BAD_REQUEST, INVALID_FILTER);
  }
}
