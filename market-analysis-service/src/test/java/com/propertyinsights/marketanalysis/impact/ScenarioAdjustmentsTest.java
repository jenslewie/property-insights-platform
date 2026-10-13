package com.propertyinsights.marketanalysis.impact;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.propertyinsights.marketanalysis.error.ApiException;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;

class ScenarioAdjustmentsTest {

  private final ObjectMapper mapper = new ObjectMapper();

  @ParameterizedTest
  @CsvSource({"6800, 5, 7140", "6800, -2.5, 6630", "1001, 50, 1502", "1, -50, 1", "500, -99.9, 1"})
  void adjustsLotSizeByPercentageAndRoundsHalfUp(int baseline, String percent, int expected)
      throws Exception {
    ScenarioAdjustments adjustments =
        ScenarioAdjustments.parse(mapper.readTree("{\"lot_size_percent\":" + percent + "}"));

    assertThat(adjustments.apply(features(baseline)).lotSize()).isEqualTo(expected);
  }

  @ParameterizedTest
  @CsvSource({"6800, -100", "1, -51", "100000, 0.0005", "6800, 1E+20"})
  void rejectsLotSizePercentagesThatRoundOutsideAllowedBounds(int baseline, String percent)
      throws Exception {
    ScenarioAdjustments adjustments =
        ScenarioAdjustments.parse(mapper.readTree("{\"lot_size_percent\":" + percent + "}"));

    assertThatThrownBy(() -> adjustments.apply(features(baseline)))
        .isInstanceOfSatisfying(
            ApiException.class,
            error -> assertThat(error.status()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY));
  }

  @Test
  void rejectsLegacyLotSizeDelta() {
    assertThatThrownBy(() -> ScenarioAdjustments.parse(mapper.readTree("{\"lot_size_delta\":500}")))
        .isInstanceOf(ApiException.class);
  }

  private HousingFeatures features(int lotSize) {
    return new HousingFeatures(
        1500, 3, new BigDecimal("2"), 1997, lotSize, new BigDecimal("4.1"), new BigDecimal("7"));
  }
}
