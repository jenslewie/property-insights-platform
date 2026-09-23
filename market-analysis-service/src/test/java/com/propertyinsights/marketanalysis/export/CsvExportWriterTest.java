package com.propertyinsights.marketanalysis.export;

import static org.assertj.core.api.Assertions.assertThat;

import com.propertyinsights.marketanalysis.property.PropertyRecord;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.junit.jupiter.api.Test;

class CsvExportWriterTest {

    private final CsvExportWriter writer = new CsvExportWriter();

    @Test
    void writesStableHeaderAndKeepsSourceOrder() throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();

        writer.write(
                List.of(
                        new PropertyRecord(
                                2,
                                1500,
                                3,
                                new BigDecimal("2.0"),
                                1997,
                                6800,
                                new BigDecimal("4.1"),
                                new BigDecimal("7.6"),
                                new BigDecimal("185000.00")),
                        new PropertyRecord(
                                1,
                                2100,
                                4,
                                new BigDecimal("3.0"),
                                2005,
                                8200,
                                new BigDecimal("5.2"),
                                new BigDecimal("8.1"),
                                new BigDecimal("310000.00"))),
                output);

        String csv = output.toString(StandardCharsets.UTF_8);
        assertThat(csv).doesNotStartWith("\uFEFF");

        try (CSVParser parser = CSVParser.parse(csv, CSVFormat.DEFAULT)) {
            List<CSVRecord> records = parser.getRecords();

            assertThat(records).hasSize(3);
            assertThat(records.getFirst().toList())
                    .containsExactly(
                            "id",
                            "square_footage",
                            "bedrooms",
                            "bathrooms",
                            "year_built",
                            "lot_size",
                            "distance_to_city_center",
                            "school_rating",
                            "price");

            assertThat(records.get(1).get(0)).isEqualTo("2");
            assertThat(records.get(1).get(1)).isEqualTo("1500");
            assertThat(records.get(1).get(3)).isEqualTo("2.0");
            assertThat(records.get(1).get(8)).isEqualTo("185000.00");

            assertThat(records.get(2).get(0)).isEqualTo("1");
            assertThat(records.get(2).get(1)).isEqualTo("2100");
            assertThat(records.get(2).get(8)).isEqualTo("310000.00");
        }
    }
}
