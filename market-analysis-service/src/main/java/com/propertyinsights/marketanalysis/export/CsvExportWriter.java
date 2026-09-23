package com.propertyinsights.marketanalysis.export;

import com.propertyinsights.marketanalysis.property.PropertyRecord;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Component;

@Component
public final class CsvExportWriter {

    private static final String[] HEADER = {
        "id",
        "square_footage",
        "bedrooms",
        "bathrooms",
        "year_built",
        "lot_size",
        "distance_to_city_center",
        "school_rating",
        "price"
    };
    private static final CSVFormat CSV_FORMAT = CSVFormat.DEFAULT.builder().setHeader(HEADER).get();

    public void write(List<PropertyRecord> rows, OutputStream output) throws IOException {
        OutputStreamWriter writer = new OutputStreamWriter(output, StandardCharsets.UTF_8);
        CSVPrinter printer = new CSVPrinter(writer, CSV_FORMAT);

        for (PropertyRecord row : rows) {
            printer.printRecord(
                    row.id(),
                    row.squareFootage(),
                    row.bedrooms(),
                    row.bathrooms(),
                    row.yearBuilt(),
                    row.lotSize(),
                    row.distanceToCityCenter(),
                    row.schoolRating(),
                    row.price());
        }

        // Streaming response 的 OutputStream 由 servlet 管理，只 flush 不关闭。
        printer.flush();
    }
}
