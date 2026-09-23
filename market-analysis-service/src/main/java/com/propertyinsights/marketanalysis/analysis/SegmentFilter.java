package com.propertyinsights.marketanalysis.analysis;

import com.propertyinsights.marketanalysis.property.PropertyRecord;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class SegmentFilter {

    static final List<String> FIELD_ORDER =
            List.of(
                    "square_footage",
                    "bedrooms",
                    "bathrooms",
                    "year_built",
                    "lot_size",
                    "distance_to_city_center",
                    "school_rating",
                    "price");

    private final Map<String, Bounds> bounds;

    SegmentFilter(Map<String, Bounds> bounds) {
        Map<String, Bounds> ordered = new LinkedHashMap<>();

        for (String field : FIELD_ORDER) {
            ordered.put(field, bounds.getOrDefault(field, new Bounds(null, null)));
        }

        this.bounds = Collections.unmodifiableMap(ordered);
    }

    public static SegmentFilter unrestricted() {
        Map<String, Bounds> emptyBounds = new LinkedHashMap<>();

        for (String field : FIELD_ORDER) {
            emptyBounds.put(field, new Bounds(null, null));
        }

        return new SegmentFilter(emptyBounds);
    }

    public boolean matches(PropertyRecord property) {
        for (String field : FIELD_ORDER) {
            if (!bounds.get(field).contains(value(property, field))) {
                return false;
            }
        }
        return true;
    }

    public Map<String, Bounds> activeBounds() {
        Map<String, Bounds> active = new LinkedHashMap<>();

        for (String field : FIELD_ORDER) {
            Bounds fieldBounds = bounds.get(field);
            if (fieldBounds.min() != null || fieldBounds.max() != null) {
                active.put(field, fieldBounds);
            }
        }

        return Collections.unmodifiableMap(active);
    }

    public String cacheKey() {
        StringBuilder key = new StringBuilder();

        for (String field : FIELD_ORDER) {
            if (!key.isEmpty()) {
                key.append(';');
            }

            Bounds fieldBounds = bounds.get(field);
            key.append(field)
                    .append('=')
                    .append(canonical(fieldBounds.min()))
                    .append(',')
                    .append(canonical(fieldBounds.max()));
        }

        return key.toString();
    }

    private static BigDecimal value(PropertyRecord property, String field) {
        return switch (field) {
            case "square_footage" -> BigDecimal.valueOf(property.squareFootage());
            case "bedrooms" -> BigDecimal.valueOf(property.bedrooms());
            case "bathrooms" -> property.bathrooms();
            case "year_built" -> BigDecimal.valueOf(property.yearBuilt());
            case "lot_size" -> BigDecimal.valueOf(property.lotSize());
            case "distance_to_city_center" -> property.distanceToCityCenter();
            case "school_rating" -> property.schoolRating();
            case "price" -> property.price();
            default -> throw new IllegalArgumentException("Unsupported property field.");
        };
    }

    private static String canonical(BigDecimal value) {
        return value == null ? "*" : value.stripTrailingZeros().toString();
    }

    public record Bounds(BigDecimal min, BigDecimal max) {

        public boolean contains(BigDecimal value) {
            return (min == null || value.compareTo(min) >= 0)
                    && (max == null || value.compareTo(max) <= 0);
        }
    }
}
