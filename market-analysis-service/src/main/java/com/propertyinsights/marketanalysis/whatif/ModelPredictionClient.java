package com.propertyinsights.marketanalysis.whatif;

import java.math.BigDecimal;
import java.util.List;

@FunctionalInterface
public interface ModelPredictionClient {

    List<BigDecimal> predict(List<HousingFeatures> properties);
}
