package com.propertyinsights.marketanalysis.property;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Properties", description = "Property records, market summaries, and distributions.")
public final class PropertyController {

    private final PropertyDataset dataset;

    public PropertyController(PropertyDataset dataset) {
        this.dataset = dataset;
    }

    @GetMapping("/api/v1/properties")
    public PropertyListResponse all() {
        List<PropertyRecord> properties = dataset.all();
        return new PropertyListResponse(properties.size(), properties);
    }
}
