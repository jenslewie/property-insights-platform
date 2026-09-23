package com.propertyinsights.marketanalysis.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

@ConfigurationProperties(prefix = "market")
public record MarketSettings(
        String datasetPath, String modelUrl, int modelTimeoutSeconds, int cacheMaximumSize) {
    public MarketSettings {
        if (!StringUtils.hasText(datasetPath)) {
            throw new IllegalArgumentException("market.dataset-path must not be blank.");
        }
        if (!StringUtils.hasText(modelUrl)) {
            throw new IllegalArgumentException("market.model-url must not be blank.");
        }
        if (modelTimeoutSeconds <= 0) {
            throw new IllegalArgumentException("market.model-timeout-seconds must be positive.");
        }
        if (cacheMaximumSize <= 0) {
            throw new IllegalArgumentException("market.cache-maximum-size must be positive.");
        }
    }
}
