package com.propertyinsights.marketanalysis.analysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import com.propertyinsights.marketanalysis.error.ApiException;
import com.propertyinsights.marketanalysis.property.PropertyRecord;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

class SegmentFilterParserTest {

    private final SegmentFilterParser parser = new SegmentFilterParser();

    @Test
    void canonicalizesAndIncludesBounds() {
        var firstParams = new LinkedMultiValueMap<String, String>();
        firstParams.add("min_price", "200000.0");

        var secondParams = new LinkedMultiValueMap<String, String>();
        secondParams.add("min_price", "200000");

        SegmentFilter first = parser.parse(firstParams);
        SegmentFilter second = parser.parse(secondParams);

        assertThat(first.cacheKey()).isEqualTo(second.cacheKey());

        var edge =
                new PropertyRecord(
                        1,
                        1200,
                        2,
                        new BigDecimal("1"),
                        1985,
                        5200,
                        new BigDecimal("3.2"),
                        new BigDecimal("7.1"),
                        new BigDecimal("200000"));

        assertThat(first.matches(edge)).isTrue();
    }

    @Test
    void rejectsUnknownDuplicateMalformedAndFractionalIntegerFilters() {
        assertBadRequest(single("sort", "price"));
        assertBadRequest(single("min_bedrooms", "2.5"));
        assertBadRequest(single("min_price", "NaN"));

        var duplicate = new LinkedMultiValueMap<String, String>();
        duplicate.add("min_price", "1");
        duplicate.add("min_price", "2");
        assertBadRequest(duplicate);

        assertBadRequest(single("min_price", " "));
    }

    @Test
    void rejectsInvertedBounds() {
        var params = new LinkedMultiValueMap<String, String>();
        params.add("min_price", "300");
        params.add("max_price", "200");

        assertBadRequest(params);
    }

    @Test
    void keepsLargeIntegralBoundsCompactInCacheKeys() {
        SegmentFilter price = parser.parse(single("min_price", "1E+1000"));
        SegmentFilter bedrooms = parser.parse(single("min_bedrooms", "1E+1000"));

        assertThat(price.cacheKey()).hasSizeLessThan(300).contains("1E+1000");
        assertThat(bedrooms.cacheKey()).hasSizeLessThan(300).contains("1E+1000");
        assertBadRequest(single("min_bedrooms", "1E-1000"));
    }

    private static LinkedMultiValueMap<String, String> single(String key, String value) {
        var params = new LinkedMultiValueMap<String, String>();
        params.add(key, value);
        return params;
    }

    private void assertBadRequest(MultiValueMap<String, String> params) {
        Throwable error = catchThrowable(() -> parser.parse(params));

        assertThat(error).isInstanceOf(ApiException.class);
        assertThat(((ApiException) error).status()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
