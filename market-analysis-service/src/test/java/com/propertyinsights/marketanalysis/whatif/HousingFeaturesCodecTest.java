package com.propertyinsights.marketanalysis.whatif;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.propertyinsights.marketanalysis.error.ApiException;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class HousingFeaturesCodecTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final HousingFeaturesCodec codec = new HousingFeaturesCodec();

    @Test
    void parsesAllSevenFeatures() {
        HousingFeatures result = codec.parse(validFeatures());

        assertThat(result)
                .isEqualTo(
                        new HousingFeatures(
                                1550,
                                3,
                                new BigDecimal("2.0"),
                                1997,
                                6800,
                                new BigDecimal("4.1"),
                                new BigDecimal("7.6")));
    }

    @Test
    void rejectsMissingOrUnknownFeatures() {
        ObjectNode missing = validFeatures();
        missing.remove("year_built");
        assertInvalid(missing);

        ObjectNode unknown = validFeatures();
        unknown.put("garage_spaces", 2);
        assertInvalid(unknown);
    }

    @Test
    void rejectsNullOrNonNumericFeatures() {
        ObjectNode nullValue = validFeatures();
        nullValue.putNull("school_rating");
        assertInvalid(nullValue);

        ObjectNode textValue = validFeatures();
        textValue.put("bedrooms", "three");
        assertInvalid(textValue);
    }

    @Test
    void rejectsFractionalIntegerFeatures() {
        ObjectNode input = validFeatures();
        input.put("bedrooms", 3.5);

        assertInvalid(input);
    }

    @Test
    void rejectsOutOfRangeFeatures() {
        ObjectNode input = validFeatures();
        input.put("school_rating", 20.1);

        assertInvalid(input);
    }

    private ObjectNode validFeatures() {
        return mapper.createObjectNode()
                .put("square_footage", 1550)
                .put("bedrooms", 3)
                .put("bathrooms", new BigDecimal("2.0"))
                .put("year_built", 1997)
                .put("lot_size", 6800)
                .put("distance_to_city_center", new BigDecimal("4.1"))
                .put("school_rating", new BigDecimal("7.6"));
    }

    private void assertInvalid(JsonNode input) {
        assertThatThrownBy(() -> codec.parse(input))
                .isInstanceOfSatisfying(
                        ApiException.class,
                        problem ->
                                assertThat(problem.status())
                                        .isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY));
    }
}
