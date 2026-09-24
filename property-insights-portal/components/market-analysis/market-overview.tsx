"use client";

import type { ReactNode } from "react";
import { useState } from "react";
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
import {
  featureDimensions,
  type FeatureDimension,
} from "@/lib/market-analysis/fields";
import type {
  DistributionResponse,
  MarketSummary,
} from "@/lib/market-analysis/schemas";

type Props = {
  summary: MarketSummary;
  priceDistribution: DistributionResponse;
  featureDistribution: DistributionResponse | null;
  dimension: FeatureDimension;
  featurePending: boolean;
  featureError?: string;
  onRetryFeature: () => void;
  onDimensionChange: (dimension: FeatureDimension) => void;
  children?: ReactNode;
};

const statisticCards = [
  ["Mean historical price", "mean"],
  ["Median historical price", "median"],
  ["Minimum historical price", "minimum"],
  ["Maximum historical price", "maximum"],
] as const;

function formatPrice(value: number | null): string {
  return value === null ? "—" : formatNumericValue(value);
}

function dimensionLabel(dimension: string): string {
  const label = dimension.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatPriceBucketTick(label: string): string {
  return label.replace(/(>=|<=|>|<)?([\d,]+)/g, (_, operator, rawValue) => {
    const value = Number(rawValue.replaceAll(",", ""));
    if (!Number.isFinite(value)) return `${operator ?? ""}${rawValue}`;
    const amount = value >= 1000 ? `${value / 1000}K` : String(value);
    const prefix = operator === ">=" ? "≥" : operator === "<=" ? "≤" : operator;
    return `${prefix ?? ""}$${amount}`;
  });
}

type DistributionTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload?: DistributionResponse["buckets"][number];
  }>;
};

export function DistributionTooltip({
  active,
  payload,
}: DistributionTooltipProps) {
  const bucket = payload?.[0]?.payload;
  if (!active || !bucket) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <p className="font-semibold">{bucket.label}</p>
      <p>Properties: {bucket.count}</p>
      <p>Average historical price: {formatPrice(bucket.average_price)}</p>
    </div>
  );
}

function DistributionPanel({
  distribution,
  dimension,
  onDimensionChange,
}: {
  distribution: DistributionResponse;
  dimension?: FeatureDimension;
  onDimensionChange?: (dimension: FeatureDimension) => void;
}) {
  const title = dimensionLabel(distribution.dimension) + " distribution";
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = "bucket-details-" + distribution.dimension;
  const isFeature = distribution.dimension !== "price";

  return (
    <section
      aria-labelledby={distribution.dimension + "-distribution-heading"}
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3
          className="text-lg font-semibold"
          id={distribution.dimension + "-distribution-heading"}
        >
          {title}
        </h3>
        {isFeature && dimension && onDimensionChange ? (
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <span>Feature for second chart</span>
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              value={dimension}
              onChange={(event) =>
                onDimensionChange(event.currentTarget.value as FeatureDimension)
              }
            >
              {featureDimensions.map((feature) => (
                <option key={feature} value={feature}>
                  {dimensionLabel(feature)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div
        aria-label={
          title + " bar chart showing property counts by fixed bucket"
        }
        className="mt-4 h-72"
        role="img"
      >
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={distribution.buckets} margin={{ bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              interval={0}
              angle={-18}
              textAnchor="end"
              tickFormatter={
                distribution.dimension === "price"
                  ? formatPriceBucketTick
                  : undefined
              }
            />
            <YAxis allowDecimals={false} />
            <Tooltip content={<DistributionTooltip />} />
            <Bar dataKey="count" fill="#1d4ed8" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <button
        aria-controls={detailsId}
        aria-expanded={detailsOpen}
        aria-label={
          (detailsOpen ? "Hide" : "View") + " bucket details for " + title
        }
        className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        onClick={() => setDetailsOpen((current) => !current)}
        type="button"
      >
        {detailsOpen ? "Hide bucket details" : "View bucket details"}
      </button>
      <div
        className="mt-4 overflow-x-auto"
        hidden={!detailsOpen}
        id={detailsId}
      >
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

function FeatureDistributionStatus({
  dimension,
  pending,
  error,
  onRetry,
  onDimensionChange,
}: {
  dimension: FeatureDimension;
  pending: boolean;
  error?: string;
  onRetry: () => void;
  onDimensionChange: (dimension: FeatureDimension) => void;
}) {
  return (
    <section
      aria-labelledby="feature-distribution-heading"
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-lg font-semibold" id="feature-distribution-heading">
          {dimensionLabel(dimension)} distribution
        </h3>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span>Feature for second chart</span>
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            value={dimension}
            onChange={(event) =>
              onDimensionChange(event.currentTarget.value as FeatureDimension)
            }
          >
            {featureDimensions.map((feature) => (
              <option key={feature} value={feature}>
                {dimensionLabel(feature)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {pending ? (
        <p className="mt-4 text-sm text-slate-600" role="status">
          Loading feature distribution…
        </p>
      ) : null}
      {error ? (
        <div
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-red-900"
          role="alert"
        >
          <p>{error}</p>
          <button
            className="rounded-lg border border-red-400 px-3 py-1 font-semibold hover:bg-red-100"
            onClick={onRetry}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function MarketOverview({
  summary,
  priceDistribution,
  featureDistribution,
  dimension,
  featurePending,
  featureError,
  onRetryFeature,
  onDimensionChange,
  children,
}: Props) {
  return (
    <>
      <section aria-labelledby="market-overview-heading" className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-bold" id="market-overview-heading">
            Historical market overview
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
      </section>
      {children}
      <div className="grid gap-5 xl:grid-cols-2">
        <DistributionPanel distribution={priceDistribution} />
        {featureDistribution ? (
          <DistributionPanel
            dimension={dimension}
            distribution={featureDistribution}
            key={featureDistribution.dimension}
            onDimensionChange={onDimensionChange}
          />
        ) : (
          <FeatureDistributionStatus
            dimension={dimension}
            error={featureError}
            key={dimension}
            onDimensionChange={onDimensionChange}
            onRetry={onRetryFeature}
            pending={featurePending}
          />
        )}
      </div>
    </>
  );
}
