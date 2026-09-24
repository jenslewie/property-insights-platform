package com.propertyinsights.marketanalysis.property;

import java.io.IOException;
import java.io.PushbackReader;
import java.io.Reader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.csv.DuplicateHeaderMode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class CsvPropertyLoader {

  private static final Logger LOGGER = LoggerFactory.getLogger(CsvPropertyLoader.class);

  private static final List<String> REQUIRED_HEADERS =
      List.of(
          "id",
          "square_footage",
          "bedrooms",
          "bathrooms",
          "year_built",
          "lot_size",
          "distance_to_city_center",
          "school_rating",
          "price");

  private static final Set<String> REQUIRED_HEADER_SET = Set.copyOf(REQUIRED_HEADERS);

  private static final CSVFormat CSV_FORMAT =
      CSVFormat.DEFAULT
          .builder()
          .setHeader()
          .setSkipHeaderRecord(true)
          .setDuplicateHeaderMode(DuplicateHeaderMode.DISALLOW)
          .get();

  public List<PropertyRecord> load(Path path) {
    long startedAt = System.nanoTime();
    LOGGER
        .atInfo()
        .addKeyValue("event", "property_dataset_load_started")
        .log("Property dataset load started");

    try {
      List<PropertyRecord> rows = loadRows(path);
      LOGGER
          .atInfo()
          .addKeyValue("event", "property_dataset_load_completed")
          .addKeyValue("row_count", rows.size())
          .addKeyValue("duration_ms", elapsedMillis(startedAt))
          .log("Property dataset load completed");
      return rows;
    } catch (RuntimeException exception) {
      LOGGER
          .atError()
          .addKeyValue("event", "property_dataset_load_failed")
          .addKeyValue("error_type", exception.getClass().getSimpleName())
          .addKeyValue("duration_ms", elapsedMillis(startedAt))
          .setCause(exception)
          .log("Property dataset load failed");
      throw exception;
    }
  }

  private static List<PropertyRecord> loadRows(Path path) {
    List<PropertyRecord> rows = new ArrayList<>();
    Set<Long> seenIds = new HashSet<>();

    try (Reader source = Files.newBufferedReader(path, StandardCharsets.UTF_8);
        PushbackReader reader = withoutLeadingBom(source);
        CSVParser parser = CSV_FORMAT.parse(reader)) {

      validateHeaders(parser.getHeaderNames());

      for (CSVRecord record : parser) {
        long rowNumber = record.getRecordNumber() + 1;
        rows.add(parseRecord(record, rowNumber, seenIds));
      }
    } catch (IOException exception) {
      throw new IllegalStateException("Unable to read property dataset.", exception);
    }

    if (rows.isEmpty()) {
      throw new IllegalStateException("Property dataset must contain at least one row.");
    }

    return List.copyOf(rows);
  }

  private static PushbackReader withoutLeadingBom(Reader source) throws IOException {
    PushbackReader reader = new PushbackReader(source, 1);
    int firstCharacter = reader.read();

    if (firstCharacter != -1 && firstCharacter != '\uFEFF') {
      reader.unread(firstCharacter);
    }

    return reader;
  }

  private static void validateHeaders(List<String> headers) {
    if (headers.size() != REQUIRED_HEADERS.size()
        || !new HashSet<>(headers).equals(REQUIRED_HEADER_SET)) {
      throw new IllegalStateException("CSV header must contain exactly the required columns.");
    }
  }

  private static PropertyRecord parseRecord(CSVRecord record, long rowNumber, Set<Long> seenIds) {
    if (!record.isConsistent()) {
      throw invalidRow(rowNumber, "wrong number of columns.");
    }

    try {
      long id = Long.parseLong(requiredValue(record, "id", rowNumber));

      if (id <= 0) {
        throw invalidRow(rowNumber, "id must be positive.");
      }

      if (!seenIds.add(id)) {
        throw invalidRow(rowNumber, "duplicate id.");
      }

      int squareFootage = Integer.parseInt(requiredValue(record, "square_footage", rowNumber));
      int bedrooms = Integer.parseInt(requiredValue(record, "bedrooms", rowNumber));
      BigDecimal bathrooms = new BigDecimal(requiredValue(record, "bathrooms", rowNumber));
      int yearBuilt = Integer.parseInt(requiredValue(record, "year_built", rowNumber));
      int lotSize = Integer.parseInt(requiredValue(record, "lot_size", rowNumber));
      BigDecimal distanceToCityCenter =
          new BigDecimal(requiredValue(record, "distance_to_city_center", rowNumber));
      BigDecimal schoolRating = new BigDecimal(requiredValue(record, "school_rating", rowNumber));
      BigDecimal price = new BigDecimal(requiredValue(record, "price", rowNumber));

      validateFeatures(
          rowNumber,
          squareFootage,
          bedrooms,
          bathrooms,
          yearBuilt,
          lotSize,
          distanceToCityCenter,
          schoolRating);

      if (price.signum() < 0) {
        throw invalidRow(rowNumber, "price must be non-negative.");
      }

      return new PropertyRecord(
          id,
          squareFootage,
          bedrooms,
          bathrooms,
          yearBuilt,
          lotSize,
          distanceToCityCenter,
          schoolRating,
          price);
    } catch (NumberFormatException exception) {
      throw invalidRow(rowNumber, "contains an invalid numeric value.");
    }
  }

  private static void validateFeatures(
      long rowNumber,
      int squareFootage,
      int bedrooms,
      BigDecimal bathrooms,
      int yearBuilt,
      int lotSize,
      BigDecimal distanceToCityCenter,
      BigDecimal schoolRating) {
    try {
      FeatureBounds.validate(
          squareFootage,
          bedrooms,
          bathrooms,
          yearBuilt,
          lotSize,
          distanceToCityCenter,
          schoolRating);
    } catch (IllegalArgumentException exception) {
      throw invalidRow(rowNumber, exception.getMessage());
    }
  }

  private static String requiredValue(CSVRecord record, String column, long rowNumber) {
    String value = record.get(column);

    if (value == null || value.isBlank()) {
      throw invalidRow(rowNumber, "required value '%s' is missing.".formatted(column));
    }

    return value.trim();
  }

  private static IllegalStateException invalidRow(long rowNumber, String reason) {
    return new IllegalStateException("Invalid CSV row %d: %s".formatted(rowNumber, reason));
  }

  private static long elapsedMillis(long startedAt) {
    return (System.nanoTime() - startedAt) / 1_000_000L;
  }
}
