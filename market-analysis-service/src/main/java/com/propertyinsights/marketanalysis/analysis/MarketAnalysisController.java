package com.propertyinsights.marketanalysis.analysis;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/properties")
@Tag(name = "Properties")
public final class MarketAnalysisController {

    private final SegmentFilterParser parser;
    private final MarketAnalysisService service;

    public MarketAnalysisController(SegmentFilterParser parser, MarketAnalysisService service) {
        this.parser = parser;
        this.service = service;
    }

    @GetMapping("/summary")
    @SegmentFilterParameters
    public MarketSummary summary(
            @Parameter(hidden = true) @RequestParam MultiValueMap<String, String> params) {
        return service.summary(parser.parse(params));
    }

    @GetMapping("/distributions/{dimension}")
    @SegmentFilterParameters
    public DistributionResponse distribution(
            @Parameter(
                            description = "Property field whose distribution is returned.",
                            example = "price",
                            schema = @Schema(implementation = DistributionDimension.class))
                    @PathVariable
                    String dimension,
            @Parameter(hidden = true) @RequestParam MultiValueMap<String, String> params) {
        return service.distribution(
                parser.parse(params), DistributionDimension.fromPath(dimension));
    }
}
