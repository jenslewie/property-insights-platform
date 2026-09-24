package com.propertyinsights.marketanalysis;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
@OpenAPIDefinition(
        info =
                @Info(
                        title = "Market Analysis API",
                        version = "1.0.0",
                        description =
                                "Property data, market analysis, price impact comparisons, and report exports."),
        tags = {
            @Tag(name = "Properties", description = "Property data operations."),
            @Tag(
                    name = "Market",
                    description = "Market statistics and scenario analysis operations.")
        })
public class MarketAnalysisApplication {

    public static void main(String[] args) {
        SpringApplication.run(MarketAnalysisApplication.class, args);
    }
}
