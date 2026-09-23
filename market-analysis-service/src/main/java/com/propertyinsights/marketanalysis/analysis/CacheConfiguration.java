package com.propertyinsights.marketanalysis.analysis;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.propertyinsights.marketanalysis.config.MarketSettings;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableCaching
public class CacheConfiguration {

    @Bean
    public CaffeineCacheManager cacheManager(MarketSettings settings) {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager("marketStats");

        cacheManager.setCaffeine(Caffeine.newBuilder().maximumSize(settings.cacheMaximumSize()));

        return cacheManager;
    }
}
