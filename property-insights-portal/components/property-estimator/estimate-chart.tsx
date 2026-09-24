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
import { formatEstimateLabel } from "@/lib/estimate-display";

type Props = {
  records: EstimateRecord[];
  title: string;
  chartLabel: string;
};

export function EstimateChart({ records, title, chartLabel }: Props) {
  if (records.length === 0) {
    return null;
  }

  const data = records.map((record) => ({
    name: formatEstimateLabel(record),
    price: record.predicted_price,
  }));
  const accessibleChartLabel = `${chartLabel}. ${data
    .map(({ name }) => name)
    .join(", ")}`;

  return (
    <div>
      <h3 className="text-lg font-semibold">{title}</h3>

      <div aria-label={accessibleChartLabel} className="mt-5 h-72" role="img">
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
    </div>
  );
}
