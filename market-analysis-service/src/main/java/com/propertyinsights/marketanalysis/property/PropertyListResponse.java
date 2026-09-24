package com.propertyinsights.marketanalysis.property;

import java.util.List;

public record PropertyListResponse(int count, List<PropertyRecord> properties) {

  public PropertyListResponse {
    properties = List.copyOf(properties);
  }
}
