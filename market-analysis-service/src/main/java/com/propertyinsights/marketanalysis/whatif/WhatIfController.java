package com.propertyinsights.marketanalysis.whatif;

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
@RequestMapping("/api/v1/what-if")
@Tag(name = "What-if", description = "Compare price predictions before and after feature changes.")
public final class WhatIfController {

    private final WhatIfService service;

    public WhatIfController(WhatIfService service) {
        this.service = service;
    }

    @PostMapping
    public WhatIfResponse analyze(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            required = true,
                            content =
                                    @Content(
                                            mediaType = "application/json",
                                            schema = @Schema(type = "object"),
                                            examples =
                                                    @ExampleObject(
                                                            name = "validWhatIf",
                                                            summary =
                                                                    "Increase living area and improve school rating.",
                                                            value =
                                                                    """
                                                                    {
                                                                      "baseline": {
                                                                        "square_footage": 1550,
                                                                        "bedrooms": 3,
                                                                        "bathrooms": 2.0,
                                                                        "year_built": 1997,
                                                                        "lot_size": 6800,
                                                                        "distance_to_city_center": 4.1,
                                                                        "school_rating": 7.6
                                                                      },
                                                                      "changes": {
                                                                        "square_footage": 1800,
                                                                        "school_rating": 8.5
                                                                      }
                                                                    }
                                                                    """)))
                    @RequestBody
                    JsonNode request) {
        if (request == null
                || !request.isObject()
                || request.size() != 2
                || !request.has("baseline")
                || !request.has("changes")) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid what-if request.");
        }

        return service.compare(request.get("baseline"), request.get("changes"));
    }
}
