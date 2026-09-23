package com.propertyinsights.marketanalysis.impact;

import java.math.BigDecimal;
import java.util.List;

@FunctionalInterface
public interface ModelPredictionClient {

    List<BigDecimal> predict(List<HousingFeatures> properties);
}
