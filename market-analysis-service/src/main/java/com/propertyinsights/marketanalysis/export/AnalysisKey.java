package com.propertyinsights.marketanalysis.export;

import com.propertyinsights.marketanalysis.analysis.SegmentFilter;
import com.propertyinsights.marketanalysis.impact.ScenarioAdjustments;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** Deterministic fingerprint of the applied market filters and scenario. */
public final class AnalysisKey {

  private static final String PREFIX = "market-analysis:v1\n";
  private static final int KEY_BYTES = 4;

  private AnalysisKey() {}

  public static String from(SegmentFilter filter, ScenarioAdjustments scenario) {
    String canonical = PREFIX + filter.cacheKey() + "\n" + scenarioKey(scenario);
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest, 0, KEY_BYTES);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable.", exception);
    }
  }

  private static String scenarioKey(ScenarioAdjustments scenario) {
    if (scenario == null || !scenario.hasEffectiveAdjustment()) {
      return "none";
    }

    return "school_rating_delta="
        + canonical(scenario.schoolRatingDelta())
        + ";square_footage_percent="
        + canonical(scenario.squareFootagePercent());
  }

  private static String canonical(java.math.BigDecimal value) {
    return value == null || value.compareTo(java.math.BigDecimal.ZERO) == 0
        ? "*"
        : value.stripTrailingZeros().toString();
  }
}
