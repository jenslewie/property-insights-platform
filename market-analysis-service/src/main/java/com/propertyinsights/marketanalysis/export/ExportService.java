package com.propertyinsights.marketanalysis.export;

import com.propertyinsights.marketanalysis.analysis.DistributionDimension;
import com.propertyinsights.marketanalysis.analysis.DistributionResponse;
import com.propertyinsights.marketanalysis.analysis.MarketAnalysisService;
import com.propertyinsights.marketanalysis.analysis.MarketSummary;
import com.propertyinsights.marketanalysis.analysis.SegmentFilter;
import com.propertyinsights.marketanalysis.error.ApiException;
import com.propertyinsights.marketanalysis.impact.HousingFeatures;
import com.propertyinsights.marketanalysis.impact.PriceImpactResponse;
import com.propertyinsights.marketanalysis.impact.PriceImpactService;
import com.propertyinsights.marketanalysis.impact.ScenarioAdjustments;
import com.propertyinsights.marketanalysis.property.PropertyDataset;
import com.propertyinsights.marketanalysis.property.PropertyRecord;
import java.time.Clock;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public final class ExportService {

  private final PropertyDataset dataset;
  private final MarketAnalysisService analysisService;
  private final PriceImpactService priceImpactService;
  private final Clock clock;

  public ExportService(
      PropertyDataset dataset,
      MarketAnalysisService analysisService,
      PriceImpactService priceImpactService,
      Clock clock) {
    this.dataset = dataset;
    this.analysisService = analysisService;
    this.priceImpactService = priceImpactService;
    this.clock = clock;
  }

  public List<PropertyRecord> properties(SegmentFilter filter) {
    return properties(filter, null);
  }

  public List<PropertyRecord> properties(SegmentFilter filter, ScenarioAdjustments scenario) {
    List<PropertyRecord> rows = dataset.all().stream().filter(filter::matches).toList();

    if (rows.isEmpty()) {
      throw noMatchingProperties();
    }

    validateScenario(rows, scenario);

    return rows;
  }

  public ReportData report(SegmentFilter filter) {
    return report(filter, null);
  }

  public ReportData report(SegmentFilter filter, ScenarioAdjustments scenario) {
    properties(filter, scenario);
    MarketSummary summary = analysisService.summary(filter);

    Map<DistributionDimension, DistributionResponse> distributions =
        new EnumMap<>(DistributionDimension.class);
    for (DistributionDimension dimension : DistributionDimension.values()) {
      distributions.put(dimension, analysisService.distribution(filter, dimension));
    }

    PriceImpactResponse priceImpact =
        scenario == null ? null : priceImpactService.compare(filter, scenario);
    return new ReportData(filter, summary, distributions, scenario, priceImpact, clock.instant());
  }

  private void validateScenario(List<PropertyRecord> rows, ScenarioAdjustments scenario) {
    if (scenario == null) {
      return;
    }
    if (!scenario.hasEffectiveAdjustment()) {
      throw invalidScenario();
    }

    boolean changed = false;
    for (PropertyRecord property : rows) {
      HousingFeatures baseline =
          new HousingFeatures(
              property.squareFootage(),
              property.bedrooms(),
              property.bathrooms(),
              property.yearBuilt(),
              property.lotSize(),
              property.distanceToCityCenter(),
              property.schoolRating());
      changed |= !sameFeatures(baseline, scenario.apply(property));
    }
    if (!changed) {
      throw invalidScenario();
    }
  }

  private boolean sameFeatures(HousingFeatures first, HousingFeatures second) {
    return first.squareFootage() == second.squareFootage()
        && first.schoolRating().compareTo(second.schoolRating()) == 0;
  }

  private static ApiException invalidScenario() {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid price impact request.");
  }

  private static ApiException noMatchingProperties() {
    return new ApiException(HttpStatus.NOT_FOUND, "No properties match the filters.");
  }
}
