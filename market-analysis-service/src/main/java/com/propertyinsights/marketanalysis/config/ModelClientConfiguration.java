package com.propertyinsights.marketanalysis.config;

import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration(proxyBeanMethods = false)
public class ModelClientConfiguration {

    @Bean
    RestClient modelRestClient(RestClient.Builder builder, MarketSettings settings) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        Duration timeout = Duration.ofSeconds(settings.modelTimeoutSeconds());

        requestFactory.setConnectTimeout(timeout);
        requestFactory.setReadTimeout(timeout);

        return builder.baseUrl(settings.modelUrl()).requestFactory(requestFactory).build();
    }
}
