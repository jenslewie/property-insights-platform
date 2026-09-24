package com.propertyinsights.marketanalysis.impact;

import com.fasterxml.jackson.databind.JsonNode;
import com.propertyinsights.marketanalysis.error.ApiException;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/market/price-impact")
@Tag(name = "Market")
public final class PriceImpactController {

    private final PriceImpactService service;

    public PriceImpactController(PriceImpactService service) {
        this.service = service;
    }

    @PostMapping
    public PriceImpactResponse analyze(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            required = true,
                            content =
                                    @Content(
                                            mediaType = "application/json",
                                            schema = @Schema(type = "object"),
                                            examples =
                                                    @ExampleObject(
                                                            name = "validPriceImpact",
                                                            summary =
                                                                    "Increase school ratings and living area for a filtered segment.",
                                                            value =
                                                                    """
                                                    {
                                                      "filters": {"min_bedrooms": 3},
                                                      "scenario": {
                                                        "adjustments": {
                                                          "school_rating_delta": 1,
                                                          "square_footage_percent": 5
                                                        }
                                                      }
                                                    }
                                                    """)))
                    @RequestBody
                    JsonNode request) {
        if (request == null
                || !request.isObject()
                || request.size() != 2
                || !request.has("filters")
                || !request.has("scenario")) {
            throw invalidRequest();
        }

        JsonNode scenario = request.get("scenario");
        if (scenario == null
                || !scenario.isObject()
                || scenario.size() != 1
                || !scenario.has("adjustments")) {
            throw invalidRequest();
        }

        return service.compare(request.get("filters"), scenario.get("adjustments"));
    }

    private static ApiException invalidRequest() {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid price impact request.");
    }
}
