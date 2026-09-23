package com.propertyinsights.marketanalysis.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import com.github.benmanes.caffeine.cache.Cache;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.util.LinkedMultiValueMap;

@SpringBootTest
class MarketCacheTest {

    @Autowired private MarketAnalysisService service;

    @Autowired private SegmentFilterParser parser;

    @Autowired private CacheManager cacheManager;

    private Cache<Object, Object> nativeCache;

    @BeforeEach
    void clearCache() {
        CaffeineCache cache = (CaffeineCache) cacheManager.getCache("marketStats");
        nativeCache = cache.getNativeCache();
        nativeCache.invalidateAll();
    }

    @Test
    void equivalentNumericFiltersUseTheSameCachedSummary() {
        var firstParams = new LinkedMultiValueMap<String, String>();
        firstParams.add("min_price", "200000.0");

        var secondParams = new LinkedMultiValueMap<String, String>();
        secondParams.add("min_price", "200000");

        MarketSummary first = service.summary(parser.parse(firstParams));
        MarketSummary second = service.summary(parser.parse(secondParams));

        assertThat(second).isSameAs(first);
        assertThat(nativeCache.asMap()).hasSize(1);
    }

    @Test
    void cacheHasMaximumSizeAndNoTimeExpiration() {
        assertThat(cacheManager.getCacheNames()).containsExactly("marketStats");

        var eviction = nativeCache.policy().eviction().orElseThrow();
        assertThat(eviction.getMaximum()).isEqualTo(500L);
        assertThat(nativeCache.policy().expireAfterWrite()).isEmpty();
        assertThat(nativeCache.policy().expireAfterAccess()).isEmpty();
    }

    @Test
    void distributionsUseDifferentKeysForDifferentDimensions() {
        SegmentFilter filter = SegmentFilter.unrestricted();

        service.distribution(filter, DistributionDimension.PRICE);
        service.distribution(filter, DistributionDimension.BEDROOMS);

        assertThat(nativeCache.asMap().keySet())
                .containsExactlyInAnyOrder(
                        "distribution:PRICE:" + filter.cacheKey(),
                        "distribution:BEDROOMS:" + filter.cacheKey());
    }
}
