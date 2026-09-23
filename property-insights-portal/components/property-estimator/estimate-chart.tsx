"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EstimateRecord } from "@/lib/types";
import { formatCompactNumber, formatNumericValue } from "@/lib/number-format";

export function EstimateChart({ records }: { records: EstimateRecord[] }) {
  if (records.length === 0) {
    return null;
  }

  const data = records.map((record, index) => ({
    name: `Property ${index + 1}`,
    price: record.predicted_price,
  }));

  return (
    <section
      aria-labelledby="estimate-comparison"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-xl font-semibold" id="estimate-comparison">
        Price comparison
      </h2>

      <div
        aria-label="Bar chart comparing predicted property prices"
        className="mt-5 h-72"
        role="img"
      >
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis
              tickFormatter={(value: number) => formatCompactNumber(value)}
            />
            <Tooltip formatter={(value) => formatNumericValue(Number(value))} />
            <Bar dataKey="price" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {records.length > 1 ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-255 text-left text-sm">
            <caption className="sr-only">Selected property comparison</caption>
            <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="whitespace-nowrap p-3" scope="col">
                  Property
                </th>
                <th className="whitespace-nowrap p-3" scope="col">
                  Square footage
                </th>
                <th className="whitespace-nowrap p-3" scope="col">
                  Bedrooms
                </th>
                <th className="whitespace-nowrap p-3" scope="col">
                  Bathrooms
                </th>
                <th className="whitespace-nowrap p-3" scope="col">
                  Year built
                </th>
                <th className="whitespace-nowrap p-3" scope="col">
                  Lot size
                </th>
                <th className="whitespace-nowrap p-3" scope="col">
                  Distance to center
                </th>
                <th className="whitespace-nowrap p-3" scope="col">
                  School rating
                </th>
                <th className="whitespace-nowrap p-3" scope="col">
                  Predicted price
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => (
                <tr className="border-t border-slate-200" key={record.id}>
                  <th className="whitespace-nowrap p-3" scope="row">
                    Property {index + 1}
                  </th>
                  <td className="p-3">
                    {formatNumericValue(record.property.square_footage)}
                  </td>
                  <td className="p-3">
                    {formatNumericValue(record.property.bedrooms)}
                  </td>
                  <td className="p-3">
                    {formatNumericValue(record.property.bathrooms)}
                  </td>
                  <td className="p-3">{record.property.year_built}</td>
                  <td className="p-3">
                    {formatNumericValue(record.property.lot_size)}
                  </td>
                  <td className="p-3">
                    {formatNumericValue(
                      record.property.distance_to_city_center,
                    )}
                  </td>
                  <td className="p-3">
                    {formatNumericValue(record.property.school_rating)}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {formatNumericValue(record.predicted_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
