package com.propertyinsights.marketanalysis.export;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class ExportClockConfiguration {

  @Bean
  Clock exportClock() {
    return Clock.systemUTC();
  }
}
