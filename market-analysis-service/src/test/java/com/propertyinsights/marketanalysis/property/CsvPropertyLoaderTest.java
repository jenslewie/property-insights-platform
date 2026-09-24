package com.propertyinsights.marketanalysis.property;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class CsvPropertyLoaderTest {

  private static final String HEADER =
      "id,square_footage,bedrooms,bathrooms,year_built,lot_size,"
          + "distance_to_city_center,school_rating,price";

  @Test
  void loadsRepositoryDatasetInSourceOrderAndReturnsImmutableList() {
    var rows = new CsvPropertyLoader().load(Path.of("../data/house-price-dataset.csv"));

    assertThat(rows).hasSize(50);
    assertThat(rows.getFirst().id()).isEqualTo(1L);
    assertThat(rows.getFirst().price()).isEqualByComparingTo("185000");
    assertThatThrownBy(rows::clear).isInstanceOf(UnsupportedOperationException.class);
  }

  @Test
  void loadsBomPrefixedDatasetWithReorderedHeaders(@TempDir Path directory) throws Exception {
    Path csv =
        writeCsv(
            directory,
            "reordered.csv",
            """
                ﻿price,school_rating,id,square_footage,bedrooms,bathrooms,year_built,lot_size,distance_to_city_center
                185000,7.1,1,1250,2,1,1985,5200,3.2
                """);

    var rows = new CsvPropertyLoader().load(csv);

    assertThat(rows).hasSize(1);
    assertThat(rows.getFirst().id()).isEqualTo(1L);
    assertThat(rows.getFirst().squareFootage()).isEqualTo(1250);
    assertThat(rows.getFirst().price()).isEqualByComparingTo("185000");
  }

  @Test
  void rejectsDuplicateIds(@TempDir Path directory) throws Exception {
    Path csv =
        writeCsv(
            directory,
            "duplicate-id.csv",
            HEADER
                + "\n"
                + "1,1250,2,1,1985,5200,3.2,7.1,185000\n"
                + "1,1850,3,2,1998,7500,5.6,8.2,265000\n");

    assertThatThrownBy(() -> new CsvPropertyLoader().load(csv))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("duplicate id");
  }

  @Test
  void rejectsDuplicateHeaders(@TempDir Path directory) throws Exception {
    Path csv =
        writeCsv(
            directory,
            "duplicate-header.csv",
            """
                id,id,bedrooms,bathrooms,year_built,lot_size,distance_to_city_center,school_rating,price
                1,1,2,1,1985,5200,3.2,7.1,185000
                """);

    assertThatThrownBy(() -> new CsvPropertyLoader().load(csv))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void rejectsMissingCell(@TempDir Path directory) throws Exception {
    Path csv =
        writeCsv(
            directory, "missing-cell.csv", HEADER + "\n" + "1,1250,2,1,1985,5200,3.2,,185000\n");

    assertThatThrownBy(() -> new CsvPropertyLoader().load(csv))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("row");
  }

  @Test
  void rejectsRowsWithWrongColumnCount(@TempDir Path directory) throws Exception {
    Path csv =
        writeCsv(directory, "short-row.csv", HEADER + "\n" + "1,1250,2,1,1985,5200,3.2,7.1\n");

    assertThatThrownBy(() -> new CsvPropertyLoader().load(csv))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("row");
  }

  @Test
  void rejectsNonnumericPrice(@TempDir Path directory) throws Exception {
    Path csv =
        writeCsv(
            directory,
            "invalid-price.csv",
            HEADER + "\n" + "1,1250,2,1,1985,5200,3.2,7.1,not-a-number\n");

    assertThatThrownBy(() -> new CsvPropertyLoader().load(csv))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("row");
  }

  @Test
  void rejectsNegativePrice(@TempDir Path directory) throws Exception {
    Path csv =
        writeCsv(
            directory, "negative-price.csv", HEADER + "\n" + "1,1250,2,1,1985,5200,3.2,7.1,-1\n");

    assertThatThrownBy(() -> new CsvPropertyLoader().load(csv))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("row");
  }

  @Test
  void rejectsDatasetWithHeaderButNoRecords(@TempDir Path directory) throws Exception {
    Path csv = writeCsv(directory, "empty.csv", HEADER + "\n");

    assertThatThrownBy(() -> new CsvPropertyLoader().load(csv))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("at least one row");
  }

  @Test
  void rejectsFeatureOutsideAllowedBounds(@TempDir Path directory) throws Exception {
    Path csv =
        writeCsv(
            directory, "invalid-feature.csv", HEADER + "\n" + "1,0,2,1,1985,5200,3.2,7.1,185000\n");

    assertThatThrownBy(() -> new CsvPropertyLoader().load(csv))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("row");
  }

  private static Path writeCsv(Path directory, String filename, String data) throws Exception {
    Path csv = directory.resolve(filename);
    Files.writeString(csv, data);
    return csv;
  }
}
