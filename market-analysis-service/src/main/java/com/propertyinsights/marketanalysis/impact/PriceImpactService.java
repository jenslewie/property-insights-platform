package com.propertyinsights.marketanalysis.impact;

import com.fasterxml.jackson.databind.JsonNode;
import com.propertyinsights.marketanalysis.analysis.SegmentFilter;
import com.propertyinsights.marketanalysis.analysis.SegmentFilterParser;
import com.propertyinsights.marketanalysis.config.MarketSettings;
import com.propertyinsights.marketanalysis.error.ApiException;
import com.propertyinsights.marketanalysis.property.PropertyDataset;
import com.propertyinsights.marketanalysis.property.PropertyRecord;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;

@Service
public final class PriceImpactService {

  private static final Logger LOGGER = LoggerFactory.getLogger(PriceImpactService.class);
  private static final int PRICE_SCALE = 2;
  private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

  private final PropertyDataset dataset;
  private final SegmentFilterParser filterParser;
  private final ModelPredictionClient predictionClient;
  private final MarketSettings settings;

  public PriceImpactService(
      PropertyDataset dataset,
      SegmentFilterParser filterParser,
      ModelPredictionClient predictionClient,
      MarketSettings settings) {
    this.dataset = dataset;
    this.filterParser = filterParser;
    this.predictionClient = predictionClient;
    this.settings = settings;
  }

  public PriceImpactResponse compare(JsonNode filtersNode, JsonNode adjustmentsNode) {
    SegmentFilter filter = filterParser.parse(filterParameters(filtersNode));
    return compare(filter, ScenarioAdjustments.parse(adjustmentsNode));
  }

  public PriceImpactResponse compare(SegmentFilter filter, ScenarioAdjustments adjustments) {
    List<PropertyRecord> matchingProperties =
        dataset.all().stream().filter(filter::matches).toList();
    if (matchingProperties.isEmpty()) {
      throw new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY, "No properties match the market filters.");
    }

    List<HousingFeatures> baselineFeatures = new ArrayList<>(matchingProperties.size());
    List<HousingFeatures> scenarioFeatures = new ArrayList<>(matchingProperties.size());
    boolean changed = false;
    for (PropertyRecord property : matchingProperties) {
      HousingFeatures baseline = features(property);
      HousingFeatures scenario = adjustments.apply(baseline);
      baselineFeatures.add(baseline);
      scenarioFeatures.add(scenario);
      changed |= !sameFeatures(baseline, scenario);
    }
    if (!changed) {
      throw invalidRequest();
    }

    List<BigDecimal> baselinePrices = new ArrayList<>(matchingProperties.size());
    List<BigDecimal> scenarioPrices = new ArrayList<>(matchingProperties.size());
    int pairsPerBatch = settings.modelBatchPredictionLimit() / 2;
    int batchCount = (matchingProperties.size() + pairsPerBatch - 1) / pairsPerBatch;

    LOGGER
        .atInfo()
        .addKeyValue("event", "market_price_impact_started")
        .addKeyValue("property_count", matchingProperties.size())
        .addKeyValue("batch_count", batchCount)
        .log("Market price impact started");

    for (int start = 0; start < matchingProperties.size(); start += pairsPerBatch) {
      int end = Math.min(start + pairsPerBatch, matchingProperties.size());
      List<HousingFeatures> inputs = new ArrayList<>((end - start) * 2);
      for (int index = start; index < end; index++) {
        inputs.add(baselineFeatures.get(index));
        inputs.add(scenarioFeatures.get(index));
      }

      List<BigDecimal> predictions = predictionClient.predict(List.copyOf(inputs));
      validatePredictions(predictions, inputs.size());
      for (int index = 0; index < predictions.size(); index += 2) {
        baselinePrices.add(predictions.get(index));
        scenarioPrices.add(predictions.get(index + 1));
      }
    }

    PriceImpactResponse response = aggregate(baselinePrices, scenarioPrices);
    LOGGER
        .atInfo()
        .addKeyValue("event", "market_price_impact_completed")
        .addKeyValue("property_count", response.propertyCount())
        .log("Market price impact completed");
    return response;
  }

  private LinkedMultiValueMap<String, String> filterParameters(JsonNode filtersNode) {
    if (filtersNode == null || !filtersNode.isObject()) {
      throw invalidRequest();
    }

    LinkedMultiValueMap<String, String> parameters = new LinkedMultiValueMap<>();
    filtersNode
        .fields()
        .forEachRemaining(
            entry -> {
              JsonNode value = entry.getValue();
              if (value == null || !value.isNumber() || !Double.isFinite(value.doubleValue())) {
                throw invalidRequest();
              }
              parameters.add(entry.getKey(), value.asText());
            });
    return parameters;
  }

  private void validatePredictions(List<BigDecimal> predictions, int expectedCount) {
    if (predictions == null
        || predictions.size() != expectedCount
        || predictions.stream().anyMatch(Objects::isNull)) {
      throw new ApiException(
          HttpStatus.BAD_GATEWAY, "Model service returned an invalid prediction response.");
    }
  }

  private PriceImpactResponse aggregate(
      List<BigDecimal> baselinePrices, List<BigDecimal> scenarioPrices) {
    PriceImpactResponse.PriceMetrics baseline = metrics(baselinePrices);
    PriceImpactResponse.PriceMetrics scenario = metrics(scenarioPrices);
    return new PriceImpactResponse(
        baselinePrices.size(),
        baseline,
        scenario,
        new PriceImpactResponse.ImpactMetrics(
            impact(baseline.mean(), scenario.mean()),
            impact(baseline.median(), scenario.median()),
            impact(baseline.minimum(), scenario.minimum()),
            impact(baseline.maximum(), scenario.maximum())));
  }

  private PriceImpactResponse.PriceMetrics metrics(List<BigDecimal> values) {
    List<BigDecimal> sorted = values.stream().sorted(Comparator.naturalOrder()).toList();
    BigDecimal sum = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    return new PriceImpactResponse.PriceMetrics(
        sum.divide(BigDecimal.valueOf(values.size()), PRICE_SCALE, RoundingMode.HALF_UP),
        median(sorted),
        sorted.getFirst().setScale(PRICE_SCALE, RoundingMode.HALF_UP),
        sorted.getLast().setScale(PRICE_SCALE, RoundingMode.HALF_UP));
  }

  private BigDecimal median(List<BigDecimal> sorted) {
    int middle = sorted.size() / 2;
    if (sorted.size() % 2 == 1) {
      return sorted.get(middle).setScale(PRICE_SCALE, RoundingMode.HALF_UP);
    }
    return sorted
        .get(middle - 1)
        .add(sorted.get(middle))
        .divide(BigDecimal.valueOf(2), PRICE_SCALE, RoundingMode.HALF_UP);
  }

  private PriceImpactResponse.MetricImpact impact(BigDecimal baseline, BigDecimal scenario) {
    BigDecimal absoluteChange =
        scenario.subtract(baseline).setScale(PRICE_SCALE, RoundingMode.HALF_UP);
    BigDecimal percentageChange =
        baseline.compareTo(BigDecimal.ZERO) == 0
            ? null
            : absoluteChange
                .multiply(ONE_HUNDRED)
                .divide(baseline, PRICE_SCALE, RoundingMode.HALF_UP);
    return new PriceImpactResponse.MetricImpact(absoluteChange, percentageChange);
  }

  private HousingFeatures features(PropertyRecord property) {
    return new HousingFeatures(
        property.squareFootage(),
        property.bedrooms(),
        property.bathrooms(),
        property.yearBuilt(),
        property.lotSize(),
        property.distanceToCityCenter(),
        property.schoolRating());
  }

  private boolean sameFeatures(HousingFeatures first, HousingFeatures second) {
    return first.squareFootage() == second.squareFootage()
        && first.bedrooms() == second.bedrooms()
        && first.bathrooms().compareTo(second.bathrooms()) == 0
        && first.yearBuilt() == second.yearBuilt()
        && first.lotSize() == second.lotSize()
        && first.distanceToCityCenter().compareTo(second.distanceToCityCenter()) == 0
        && first.schoolRating().compareTo(second.schoolRating()) == 0;
  }

  private static ApiException invalidRequest() {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid price impact request.");
  }
}
