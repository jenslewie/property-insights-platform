package com.propertyinsights.marketanalysis.analysis;

import com.propertyinsights.marketanalysis.property.PropertyDataset;
import com.propertyinsights.marketanalysis.property.PropertyRecord;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class MarketAnalysisService {

    private static final Logger LOGGER = LoggerFactory.getLogger(MarketAnalysisService.class);

    private static final int MONEY_SCALE = 2;

    private final PropertyDataset dataset;

    public MarketAnalysisService(PropertyDataset dataset) {
        this.dataset = dataset;
    }

    @Cacheable(cacheNames = "marketStats", key = "'summary:' + #p0.cacheKey()")
    public MarketSummary summary(SegmentFilter filter) {
        List<PropertyRecord> allRows = dataset.all();
        List<PropertyRecord> matchingRows = allRows.stream().filter(filter::matches).toList();

        MarketSummary result = calculateSummary(matchingRows, allRows.size());

        LOGGER.atInfo()
                .addKeyValue("event", "market_summary_calculated")
                .addKeyValue("total_count", result.totalCount())
                .addKeyValue("matched_count", result.matchedCount())
                .log("Market summary calculated");

        return result;
    }

    @Cacheable(
            cacheNames = "marketStats",
            key = "'distribution:' + #p1.name() + ':' + #p0.cacheKey()")
    public DistributionResponse distribution(
            SegmentFilter filter, DistributionDimension dimension) {
        List<PropertyRecord> allRows = dataset.all();
        DistributionResponse result = calculateDistribution(allRows, filter, dimension);

        LOGGER.atInfo()
                .addKeyValue("event", "market_distribution_calculated")
                .addKeyValue("dimension", dimension.path())
                .addKeyValue("matched_count", result.matchedCount())
                .addKeyValue("bucket_count", result.buckets().size())
                .log("Market distribution calculated");

        return result;
    }

    private MarketSummary calculateSummary(List<PropertyRecord> rows, int totalCount) {
        if (rows.isEmpty()) {
            return new MarketSummary(
                    totalCount, 0, new MarketSummary.PriceStats(null, null, null, null));
        }

        List<BigDecimal> prices = rows.stream().map(PropertyRecord::price).sorted().toList();

        BigDecimal sum = prices.stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal mean =
                sum.divide(BigDecimal.valueOf(prices.size()), MONEY_SCALE, RoundingMode.HALF_UP);

        int middle = prices.size() / 2;
        BigDecimal median;

        if (prices.size() % 2 == 0) {
            median =
                    prices.get(middle - 1)
                            .add(prices.get(middle))
                            .divide(BigDecimal.valueOf(2), MONEY_SCALE, RoundingMode.HALF_UP);
        } else {
            median = prices.get(middle).setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        }

        BigDecimal minimum = prices.getFirst().setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        BigDecimal maximum = prices.getLast().setScale(MONEY_SCALE, RoundingMode.HALF_UP);

        return new MarketSummary(
                totalCount,
                rows.size(),
                new MarketSummary.PriceStats(mean, median, minimum, maximum));
    }

    private DistributionResponse calculateDistribution(
            List<PropertyRecord> allRows, SegmentFilter filter, DistributionDimension dimension) {
        List<BucketAccumulator> buckets =
                bucketTemplates(allRows, dimension).stream().map(BucketAccumulator::new).toList();

        int matchedCount = 0;

        for (PropertyRecord row : allRows) {
            if (!filter.matches(row)) {
                continue;
            }

            matchedCount++;
            BigDecimal value = valueFor(row, dimension);

            BucketAccumulator bucket =
                    buckets.stream()
                            .filter(candidate -> candidate.contains(value))
                            .findFirst()
                            .orElseThrow(
                                    () ->
                                            new IllegalStateException(
                                                    "Property did not match a distribution bucket."));

            bucket.add(row.price());
        }

        return new DistributionResponse(
                dimension,
                matchedCount,
                buckets.stream().map(BucketAccumulator::toBucket).toList());
    }

    private List<BucketTemplate> bucketTemplates(
            List<PropertyRecord> allRows, DistributionDimension dimension) {
        return switch (dimension) {
            case BEDROOMS, BATHROOMS -> exactValueTemplates(allRows, dimension);
            case PRICE ->
                    rangeTemplates(
                            new BigDecimal("200000"),
                            new BigDecimal("250000"),
                            new BigDecimal("300000"),
                            new BigDecimal("350000"));
            case SQUARE_FOOTAGE ->
                    rangeTemplates(
                            new BigDecimal("1200"), new BigDecimal("1600"), new BigDecimal("2000"));
            case YEAR_BUILT ->
                    rangeTemplates(
                            new BigDecimal("1980"),
                            new BigDecimal("1990"),
                            new BigDecimal("2000"),
                            new BigDecimal("2010"));
            case LOT_SIZE ->
                    rangeTemplates(
                            new BigDecimal("6000"),
                            new BigDecimal("8000"),
                            new BigDecimal("10000"));
            case DISTANCE_TO_CITY_CENTER ->
                    rangeTemplates(new BigDecimal("3"), new BigDecimal("5"), new BigDecimal("7"));
            case SCHOOL_RATING ->
                    rangeTemplates(new BigDecimal("7"), new BigDecimal("8"), new BigDecimal("9"));
        };
    }

    private List<BucketTemplate> rangeTemplates(BigDecimal... cutPoints) {
        List<BucketTemplate> templates = new ArrayList<>();
        BigDecimal lower = null;

        for (BigDecimal upper : cutPoints) {
            String key =
                    lower == null ? "lt_" + token(upper) : token(lower) + "_to_" + token(upper);
            String label =
                    lower == null ? "<" + number(upper) : number(lower) + "–<" + number(upper);

            templates.add(new BucketTemplate(key, label, lower, upper, null));
            lower = upper;
        }

        templates.add(
                new BucketTemplate("gte_" + token(lower), ">=" + number(lower), lower, null, null));

        return List.copyOf(templates);
    }

    private List<BucketTemplate> exactValueTemplates(
            List<PropertyRecord> allRows, DistributionDimension dimension) {
        TreeSet<BigDecimal> values = new TreeSet<>();

        for (PropertyRecord row : allRows) {
            values.add(valueFor(row, dimension));
        }

        return values.stream()
                .map(
                        value -> {
                            String canonical = number(value);
                            return new BucketTemplate(
                                    "exact_" + token(value), canonical, null, null, value);
                        })
                .toList();
    }

    private static BigDecimal valueFor(PropertyRecord row, DistributionDimension dimension) {
        return switch (dimension) {
            case PRICE -> row.price();
            case SQUARE_FOOTAGE -> BigDecimal.valueOf(row.squareFootage());
            case BEDROOMS -> BigDecimal.valueOf(row.bedrooms());
            case BATHROOMS -> row.bathrooms();
            case YEAR_BUILT -> BigDecimal.valueOf(row.yearBuilt());
            case LOT_SIZE -> BigDecimal.valueOf(row.lotSize());
            case DISTANCE_TO_CITY_CENTER -> row.distanceToCityCenter();
            case SCHOOL_RATING -> row.schoolRating();
        };
    }

    private static String number(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }

    private static String token(BigDecimal value) {
        return number(value).replace("-", "minus_").replace(".", "_");
    }

    private record BucketTemplate(
            String key,
            String label,
            BigDecimal minInclusive,
            BigDecimal maxExclusive,
            BigDecimal exactValue) {
        private boolean contains(BigDecimal value) {
            if (exactValue != null) {
                return value.compareTo(exactValue) == 0;
            }

            return (minInclusive == null || value.compareTo(minInclusive) >= 0)
                    && (maxExclusive == null || value.compareTo(maxExclusive) < 0);
        }
    }

    private static final class BucketAccumulator {

        private final BucketTemplate template;
        private int count;
        private BigDecimal priceSum = BigDecimal.ZERO;

        private BucketAccumulator(BucketTemplate template) {
            this.template = template;
        }

        private boolean contains(BigDecimal value) {
            return template.contains(value);
        }

        private void add(BigDecimal price) {
            count++;
            priceSum = priceSum.add(price);
        }

        private DistributionBucket toBucket() {
            BigDecimal averagePrice =
                    count == 0
                            ? null
                            : priceSum.divide(
                                    BigDecimal.valueOf(count), MONEY_SCALE, RoundingMode.HALF_UP);

            return new DistributionBucket(
                    template.key(),
                    template.label(),
                    template.minInclusive(),
                    template.maxExclusive(),
                    template.exactValue(),
                    count,
                    averagePrice);
        }
    }
}
