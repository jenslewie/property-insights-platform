package com.propertyinsights.marketanalysis.property;

import com.propertyinsights.marketanalysis.config.MarketSettings;
import java.nio.file.Path;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public final class CsvPropertyDataset implements PropertyDataset {

  private final List<PropertyRecord> properties;

  public CsvPropertyDataset(MarketSettings settings) {
    List<PropertyRecord> loaded = new CsvPropertyLoader().load(Path.of(settings.datasetPath()));
    this.properties = List.copyOf(loaded);
  }

  @Override
  public List<PropertyRecord> all() {
    return properties;
  }
}
