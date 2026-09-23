package com.propertyinsights.marketanalysis.property;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class FeatureBoundsTest {

    @Test
    void yearLimitMovesForwardAtUtcNewYear() {
        Clock before = Clock.fixed(Instant.parse("2026-12-31T23:59:59Z"), ZoneOffset.UTC);
        Clock after = Clock.fixed(Instant.parse("2027-01-01T00:00:00Z"), ZoneOffset.UTC);

        assertThatThrownBy(() -> validate(2032, before))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatCode(() -> validate(2032, after)).doesNotThrowAnyException();
        assertThatThrownBy(() -> validate(2033, after))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static void validate(int yearBuilt, Clock clock) {
        FeatureBounds.validate(
                1_000,
                2,
                new BigDecimal("1.5"),
                yearBuilt,
                5_000,
                new BigDecimal("3.2"),
                new BigDecimal("7.1"),
                clock);
    }
}
