package com.propertyinsights.marketanalysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.propertyinsights.marketanalysis.analysis.DistributionDimension;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class OpenApiDocumentationTest {

    @Autowired private MockMvc mvc;

    @Autowired private ObjectMapper objectMapper;

    @Test
    void servesOpenApiDocumentAndSwaggerUi() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("Market Analysis API"))
                .andExpect(jsonPath("$.paths['/api/v1/properties/summary']").exists());

        mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
    }

    @Test
    void providesRunnableExampleForWhatIfRequestBody() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/what-if'].post.parameters").doesNotExist())
                .andExpect(
                        jsonPath("$.paths['/api/v1/what-if'].post.requestBody.required")
                                .value(true))
                .andExpect(
                        jsonPath(
                                        "$.paths['/api/v1/what-if'].post.requestBody.content['application/json'].schema.type")
                                .value("object"))
                .andExpect(
                        jsonPath(
                                        "$.paths['/api/v1/what-if'].post.requestBody.content['application/json'].examples.validWhatIf.value.baseline.square_footage")
                                .value(1550))
                .andExpect(
                        jsonPath(
                                        "$.paths['/api/v1/what-if'].post.requestBody.content['application/json'].examples.validWhatIf.value.changes.square_footage")
                                .value(1800))
                .andExpect(
                        jsonPath(
                                        "$.paths['/api/v1/what-if'].post.requestBody.content['application/json'].examples.validWhatIf.value.changes.school_rating")
                                .value(8.5));
    }

    @Test
    void propertyListEndpointHasNoQueryParametersInTheSpec() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/properties'].get.parameters").doesNotExist());
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "/api/v1/properties/summary",
                "/api/v1/properties/distributions/{dimension}",
                "/api/v1/exports/properties.csv",
                "/api/v1/exports/market-report.pdf"
            })
    void documentsAllFiltersWithRunnableExamples(String path) throws Exception {
        JsonNode document = openApiDocument();
        JsonNode operation = document.path("paths").path(path).path("get");
        Map<String, String> fieldTypes =
                Map.of(
                        "square_footage",
                        "integer",
                        "bedrooms",
                        "integer",
                        "bathrooms",
                        "number",
                        "year_built",
                        "integer",
                        "lot_size",
                        "integer",
                        "distance_to_city_center",
                        "number",
                        "school_rating",
                        "number",
                        "price",
                        "number");
        var names = new ArrayList<String>();
        var exampleRequest = get(path.replace("{dimension}", "price"));

        for (JsonNode parameter : operation.path("parameters")) {
            if (!parameter.path("in").asText().equals("query")) {
                continue;
            }
            String name = parameter.path("name").asText();
            assertThat(name).matches("(min|max)_.+");
            names.add(name);
            assertThat(parameter.path("required").asBoolean()).isFalse();
            assertThat(parameter.path("description").asText()).isNotBlank();
            assertThat(parameter.path("schema").path("type").asText())
                    .isEqualTo(fieldTypes.get(name.substring(4)));
            assertThat(parameter.path("schema").has("default")).isFalse();
            String example = parameter.path("example").asText();
            assertThat(example).isNotBlank();
            exampleRequest.param(name, example);
        }
        assertThat(names)
                .containsExactlyInAnyOrderElementsOf(
                        fieldTypes.keySet().stream()
                                .flatMap(field -> Stream.of("min_" + field, "max_" + field))
                                .toList());
        assertThat(operation.path("description").asText()).isNotBlank();

        var result = mvc.perform(exampleRequest).andReturn();
        if (result.getRequest().isAsyncStarted()) {
            result = mvc.perform(asyncDispatch(result)).andReturn();
        }
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        if (path.endsWith("/summary")) {
            assertThat(
                            objectMapper
                                    .readTree(result.getResponse().getContentAsString())
                                    .path("matched_count")
                                    .asInt())
                    .isPositive();
        }
    }

    @Test
    void documentsDistributionDimensionsWithAnExample() throws Exception {
        JsonNode document = openApiDocument();
        JsonNode parameters =
                document.path("paths")
                        .path("/api/v1/properties/distributions/{dimension}")
                        .path("get")
                        .path("parameters");
        var pathParameters = new ArrayList<JsonNode>();
        parameters.forEach(
                parameter -> {
                    if (parameter.path("in").asText().equals("path")) {
                        pathParameters.add(parameter);
                    }
                });
        assertThat(pathParameters).hasSize(1);
        JsonNode dimension = pathParameters.getFirst();
        assertThat(dimension.path("name").asText()).isEqualTo("dimension");
        assertThat(dimension.path("required").asBoolean()).isTrue();
        assertThat(dimension.path("example").asText()).isEqualTo("price");
        JsonNode schema = dimension.path("schema");
        if (schema.has("$ref")) {
            schema = document.at(schema.path("$ref").asText().substring(1));
        }
        var values = new ArrayList<String>();
        schema.path("enum").forEach(value -> values.add(value.asText()));
        assertThat(values)
                .containsExactlyInAnyOrderElementsOf(
                        Arrays.stream(DistributionDimension.values())
                                .map(DistributionDimension::path)
                                .toList());
    }

    private JsonNode openApiDocument() throws Exception {
        return objectMapper.readTree(
                mvc.perform(get("/v3/api-docs"))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString());
    }

    @Test
    void usesResourceNamesForControllerTags() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.paths['/api/v1/properties'].get.tags[0]").value("Properties"))
                .andExpect(
                        jsonPath("$.paths['/api/v1/properties/summary'].get.tags[0]")
                                .value("Properties"))
                .andExpect(
                        jsonPath(
                                        "$.paths['/api/v1/properties/distributions/{dimension}'].get.tags[0]")
                                .value("Properties"))
                .andExpect(jsonPath("$.paths['/api/v1/what-if'].post.tags[0]").value("What-if"))
                .andExpect(
                        jsonPath("$.paths['/api/v1/exports/properties.csv'].get.tags[0]")
                                .value("Exports"))
                .andExpect(
                        jsonPath("$.paths['/api/v1/exports/market-report.pdf'].get.tags[0]")
                                .value("Exports"));
    }
}
