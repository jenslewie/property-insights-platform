package com.propertyinsights.marketanalysis.export;

import static org.assertj.core.api.Assertions.assertThat;

import com.propertyinsights.marketanalysis.analysis.SegmentFilterParser;
import com.propertyinsights.marketanalysis.impact.ScenarioAdjustments;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.util.LinkedMultiValueMap;

class AnalysisKeyTest {

    private final SegmentFilterParser parser = new SegmentFilterParser();

    @Test
    void returnsTheShortHexPrefixOfTheDocumentedUnfilteredDigest() {
        assertThat(AnalysisKey.from(parser.parse(new LinkedMultiValueMap<>()), null))
                .hasSize(8)
                .isEqualTo("145a21b6");
    }

    @Test
    void normalizesFilterOrderDecimalScaleAndZeroAdjustment() {
        LinkedMultiValueMap<String, String> firstFilters = new LinkedMultiValueMap<>();
        firstFilters.add("min_bedrooms", "3");
        firstFilters.add("max_price", "500000.00");
        LinkedMultiValueMap<String, String> reorderedFilters = new LinkedMultiValueMap<>();
        reorderedFilters.add("max_price", "500000");
        reorderedFilters.add("min_bedrooms", "3.0");

        String first =
                AnalysisKey.from(
                        parser.parse(firstFilters),
                        new ScenarioAdjustments(new BigDecimal("1.00"), BigDecimal.ZERO));
        String equivalent =
                AnalysisKey.from(
                        parser.parse(reorderedFilters),
                        new ScenarioAdjustments(new BigDecimal("1.0"), null));

        assertThat(equivalent).isEqualTo(first);
    }

    @Test
    void changesWhenAFilterOrScenarioValueChanges() {
        LinkedMultiValueMap<String, String> filters = new LinkedMultiValueMap<>();
        filters.add("min_bedrooms", "3");
        var filter = parser.parse(filters);
        String original = AnalysisKey.from(filter, new ScenarioAdjustments(BigDecimal.ONE, null));

        LinkedMultiValueMap<String, String> changedFilters = new LinkedMultiValueMap<>();
        changedFilters.add("min_bedrooms", "4");

        assertThat(
                        AnalysisKey.from(
                                parser.parse(changedFilters),
                                new ScenarioAdjustments(BigDecimal.ONE, null)))
                .isNotEqualTo(original);
        assertThat(AnalysisKey.from(filter, new ScenarioAdjustments(new BigDecimal("2"), null)))
                .isNotEqualTo(original);
    }
}
