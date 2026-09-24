package com.propertyinsights.marketanalysis.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import com.propertyinsights.marketanalysis.property.CsvPropertyLoader;
import com.propertyinsights.marketanalysis.property.PropertyDataset;
import com.propertyinsights.marketanalysis.property.PropertyRecord;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.util.LinkedMultiValueMap;

class MarketSummaryTest {

  private final PropertyDataset dataset =
      () -> new CsvPropertyLoader().load(Path.of("../data/house-price-dataset.csv"));

  @Test
  void calculatesSummaryFromHistoricalDataset() {
    var summary = new MarketAnalysisService(dataset).summary(SegmentFilter.unrestricted());

    assertThat(summary.totalCount()).isEqualTo(50);
    assertThat(summary.matchedCount()).isEqualTo(50);
    assertThat(summary.price().mean()).isEqualByComparingTo("264600.00");
    assertThat(summary.price().median()).isEqualByComparingTo("245000.00");
    assertThat(summary.price().minimum()).isEqualByComparingTo("160000.00");
    assertThat(summary.price().maximum()).isEqualByComparingTo("410000.00");
  }

  @Test
  void returnsNullPriceMetricsWhenNoRowsMatch() {
    var params = new LinkedMultiValueMap<String, String>();
    params.add("min_price", "999999");

    SegmentFilter filter = new SegmentFilterParser().parse(params);
    var summary = new MarketAnalysisService(dataset).summary(filter);

    assertThat(summary.totalCount()).isEqualTo(50);
    assertThat(summary.matchedCount()).isZero();
    assertThat(summary.price().mean()).isNull();
    assertThat(summary.price().median()).isNull();
    assertThat(summary.price().minimum()).isNull();
    assertThat(summary.price().maximum()).isNull();
  }

  @Test
  void roundsEvenSampleMedianHalfCentUp() {
    List<PropertyRecord> rows = List.of(property(1, "1.00"), property(2, "1.01"));
    PropertyDataset smallDataset = () -> rows;

    var summary = new MarketAnalysisService(smallDataset).summary(SegmentFilter.unrestricted());

    assertThat(summary.price().median()).isEqualByComparingTo("1.01");
  }

  private static PropertyRecord property(long id, String price) {
    return new PropertyRecord(
        id,
        1200,
        2,
        new BigDecimal("1.0"),
        1985,
        5200,
        new BigDecimal("3.2"),
        new BigDecimal("7.1"),
        new BigDecimal(price));
  }
}
