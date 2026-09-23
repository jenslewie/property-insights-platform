package com.propertyinsights.marketanalysis.impact;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.propertyinsights.marketanalysis.error.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public final class PriceImpactService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PriceImpactService.class);
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    private static final int MONEY_SCALE = 2;
    private static final int PERCENTAGE_SCALE = 2;

    private final HousingFeaturesCodec codec;
    private final ModelPredictionClient predictionClient;

    public PriceImpactService(HousingFeaturesCodec codec, ModelPredictionClient predictionClient) {
        this.codec = codec;
        this.predictionClient = predictionClient;
    }

    public PriceImpactResponse compare(JsonNode baselineNode, JsonNode changesNode) {
        HousingFeatures baseline = codec.parse(baselineNode);

        if (changesNode == null || !changesNode.isObject() || changesNode.isEmpty()) {
            throw invalidRequest();
        }

        ObjectNode scenarioNode = ((ObjectNode) baselineNode).deepCopy();
        Iterator<Map.Entry<String, JsonNode>> fields = changesNode.fields();

        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> field = fields.next();

            if (!HousingFeature.contains(field.getKey()) || !field.getValue().isNumber()) {
                throw invalidRequest();
            }

            scenarioNode.set(field.getKey(), field.getValue().deepCopy());
        }

        HousingFeatures scenario = codec.parse(scenarioNode);
        Map<String, PriceImpactResponse.FeatureChange> effectiveChanges =
                effectiveChanges(baseline, scenario);

        if (effectiveChanges.isEmpty()) {
            throw invalidRequest();
        }

        LOGGER.atInfo()
                .addKeyValue("event", "price_impact_analysis_started")
                .addKeyValue("changed_feature_count", effectiveChanges.size())
                .log("Price impact analysis started");

        List<BigDecimal> prices = predictionClient.predict(List.of(baseline, scenario));

        if (prices == null
                || prices.size() != 2
                || prices.get(0) == null
                || prices.get(1) == null) {
            throw new ApiException(
                    HttpStatus.BAD_GATEWAY,
                    "Model service returned an invalid prediction response.");
        }

        BigDecimal baselinePredictedPrice =
                prices.get(0).setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        BigDecimal scenarioPredictedPrice =
                prices.get(1).setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        BigDecimal absoluteChange = scenarioPredictedPrice.subtract(baselinePredictedPrice);
        BigDecimal percentageChange =
                baselinePredictedPrice.compareTo(BigDecimal.ZERO) == 0
                        ? null
                        : absoluteChange
                                .multiply(ONE_HUNDRED)
                                .divide(
                                        baselinePredictedPrice,
                                        PERCENTAGE_SCALE,
                                        RoundingMode.HALF_UP);

        LOGGER.atInfo()
                .addKeyValue("event", "price_impact_analysis_completed")
                .addKeyValue("changed_feature_count", effectiveChanges.size())
                .log("Price impact analysis completed");

        return new PriceImpactResponse(
                baseline,
                effectiveChanges,
                baselinePredictedPrice,
                scenarioPredictedPrice,
                absoluteChange,
                percentageChange);
    }

    private Map<String, PriceImpactResponse.FeatureChange> effectiveChanges(
            HousingFeatures baseline, HousingFeatures scenario) {
        Map<String, PriceImpactResponse.FeatureChange> result = new LinkedHashMap<>();

        for (HousingFeature feature : HousingFeature.values()) {
            BigDecimal from = feature.valueOf(baseline);
            BigDecimal to = feature.valueOf(scenario);

            if (from.compareTo(to) != 0) {
                result.put(feature.jsonName(), new PriceImpactResponse.FeatureChange(from, to));
            }
        }

        return result;
    }

    private ApiException invalidRequest() {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid price impact request.");
    }
}
