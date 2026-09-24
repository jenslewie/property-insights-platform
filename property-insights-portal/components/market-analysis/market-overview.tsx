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
import { formatNumericValue } from "@/lib/number-format";
import type {
  DistributionResponse,
  MarketSummary,
} from "@/lib/market-analysis/schemas";

type Props = {
  summary: MarketSummary;
  priceDistribution: DistributionResponse;
  featureDistribution: DistributionResponse;
};

const statisticCards = [
  ["Mean sample price", "mean"],
  ["Median sample price", "median"],
  ["Minimum sample price", "minimum"],
  ["Maximum sample price", "maximum"],
] as const;

function formatPrice(value: number | null): string {
  return value === null ? "—" : formatNumericValue(value);
}

function dimensionLabel(dimension: string): string {
  const label = dimension.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function DistributionPanel({
  distribution,
}: {
  distribution: DistributionResponse;
}) {
  const title = `${dimensionLabel(distribution.dimension)} distribution`;
  return (
    <section
      aria-labelledby={`${distribution.dimension}-distribution-heading`}
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h3
        className="text-lg font-semibold"
        id={`${distribution.dimension}-distribution-heading`}
      >
        {title}
      </h3>
      <div
        aria-label={`${title} bar chart showing property counts by fixed bucket`}
        className="mt-4 h-72"
        role="img"
      >
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={distribution.buckets} margin={{ bottom: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" interval={0} angle={-18} textAnchor="end" />
            <YAxis allowDecimals={false} />
            <Tooltip
              formatter={(value) => [Number(value), "Properties"]}
              labelFormatter={(label) => String(label)}
            />
            <Bar dataKey="count" fill="#1d4ed8" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table
          className="w-full min-w-80 text-left text-sm"
          aria-label={`${title} values`}
        >
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="p-3" scope="col">
                Bucket
              </th>
              <th className="p-3" scope="col">
                Properties
              </th>
              <th className="p-3" scope="col">
                Average historical price
              </th>
            </tr>
          </thead>
          <tbody>
            {distribution.buckets.map((bucket) => (
              <tr className="border-t border-slate-200" key={bucket.key}>
                <th className="whitespace-nowrap p-3 font-medium" scope="row">
                  {bucket.label}
                </th>
                <td className="p-3">{bucket.count}</td>
                <td className="whitespace-nowrap p-3">
                  {formatPrice(bucket.average_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function MarketOverview({
  summary,
  priceDistribution,
  featureDistribution,
}: Props) {
  const distributions = [priceDistribution, featureDistribution];

  return (
    <section className="space-y-5" aria-labelledby="market-overview-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold" id="market-overview-heading">
          Market overview
        </h2>
        <p className="text-sm text-slate-600">CSV sample historical prices</p>
      </div>
      {summary.matched_count === 0 ? (
        <p
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"
          role="status"
        >
          No properties match this segment.
        </p>
      ) : null}
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statisticCards.map(([label, key]) => (
          <div
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            key={key}
          >
            <dt className="text-sm font-medium text-slate-600">{label}</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums">
              {formatPrice(summary.price[key])}
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-5 xl:grid-cols-2">
        {distributions.map((distribution) => (
          <DistributionPanel
            distribution={distribution}
            key={distribution.dimension}
          />
        ))}
      </div>
    </section>
  );
}
