"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { formatNumericValue } from "@/lib/number-format";
import { featureDimensions } from "@/lib/market-analysis/fields";
import type { FeatureDimension } from "@/lib/market-analysis/fields";
import {
  priceImpactResponseSchema,
  type PriceImpactResponse,
  type PropertyRecord,
} from "@/lib/market-analysis/schemas";
import { propertySchema } from "@/lib/property-schema";
import type { PropertyFeatures } from "@/lib/types";

const fields: Array<{
  name: FeatureDimension;
  label: string;
  step: string;
}> = [
  { name: "square_footage", label: "Square footage", step: "1" },
  { name: "bedrooms", label: "Bedrooms", step: "1" },
  { name: "bathrooms", label: "Bathrooms", step: "0.5" },
  { name: "year_built", label: "Year built", step: "1" },
  { name: "lot_size", label: "Lot size", step: "1" },
  {
    name: "distance_to_city_center",
    label: "Distance to city center",
    step: "0.1",
  },
  { name: "school_rating", label: "School rating", step: "0.1" },
];

const featureLabels: Record<FeatureDimension, string> = Object.fromEntries(
  fields.map(({ name, label }) => [name, label]),
) as Record<FeatureDimension, string>;

function baselineForProperty(property: PropertyRecord): PropertyFeatures {
  return propertySchema.parse(
    Object.fromEntries(
      featureDimensions.map((field) => [field, property[field]]),
    ),
  );
}

function formatSignedValue(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatNumericValue(Math.abs(value))}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function responseError(payload: unknown): string {
  if (isRecord(payload) && typeof payload.error === "string") {
    return payload.error.slice(0, 500);
  }
  return "The price impact request failed.";
}

function ImpactResult({ result }: { result: PriceImpactResponse }) {
  const percentage =
    result.percentage_change === null
      ? "Unavailable"
      : `${formatSignedValue(result.percentage_change)}%`;

  return (
    <section
      aria-labelledby="price-impact-result-heading"
      className="rounded-xl border border-blue-200 bg-blue-50 p-4"
    >
      <h3 className="text-lg font-semibold" id="price-impact-result-heading">
        Model prediction results
      </h3>
      <dl className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <dt className="text-sm text-slate-600">
            Model predicted baseline price
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {formatNumericValue(result.baseline_predicted_price)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">
            Model predicted scenario price
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {formatNumericValue(result.scenario_predicted_price)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Absolute predicted change</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {formatSignedValue(result.absolute_change)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">
            Percentage predicted change
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {percentage}
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <h4 className="font-semibold">Effective feature changes</h4>
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {Object.entries(result.changes).map(([field, change]) => (
            <li className="rounded-full bg-white px-3 py-1" key={field}>
              {featureLabels[field as FeatureDimension]}:{" "}
              {formatNumericValue(change.from)}
              {" → "}
              {formatNumericValue(change.to)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function PriceImpact({ property }: { property: PropertyRecord }) {
  const propertyKey = JSON.stringify([
    property.id,
    ...featureDimensions.map((field) => property[field]),
  ]);
  return <PriceImpactForm key={propertyKey} property={property} />;
}

function PriceImpactForm({ property }: { property: PropertyRecord }) {
  const baseline = useMemo(() => baselineForProperty(property), [property]);
  const latestRequest = useRef(0);
  const [pending, setPending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<PriceImpactResponse | null>(null);
  const {
    control,
    formState: { errors },
    getValues,
    register,
    trigger,
  } = useForm<PropertyFeatures>({
    resolver: zodResolver(propertySchema),
    defaultValues: baseline,
  });
  const values = useWatch({ control });
  const hasEffectiveChange = fields.some(
    ({ name }) =>
      Number.isFinite(values[name]) && values[name] !== baseline[name],
  );

  useEffect(
    () => () => {
      latestRequest.current += 1;
    },
    [],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const requestId = ++latestRequest.current;
    setPending(true);
    setResult(null);
    setRequestError(null);
    if (!(await trigger())) {
      if (requestId === latestRequest.current) setPending(false);
      return;
    }

    const scenario = getValues();
    const changes = Object.fromEntries(
      fields
        .filter(({ name }) => scenario[name] !== baseline[name])
        .map(({ name }) => [name, scenario[name]]),
    ) as Partial<PropertyFeatures>;
    if (Object.keys(changes).length === 0) {
      setPending(false);
      return;
    }

    try {
      const response = await fetch("/api/market-analysis/price-impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseline, changes }),
        cache: "no-store",
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        if (requestId === latestRequest.current) {
          setRequestError("The price impact response was invalid.");
        }
        return;
      }

      if (requestId !== latestRequest.current) return;
      if (!response.ok) {
        setRequestError(responseError(payload));
        return;
      }

      const parsed = priceImpactResponseSchema.safeParse(payload);
      if (!parsed.success) {
        setRequestError("The price impact response was invalid.");
        return;
      }
      setResult(parsed.data);
    } catch {
      if (requestId === latestRequest.current) {
        setRequestError(
          "The market analysis service is unavailable. Please try again.",
        );
      }
    } finally {
      if (requestId === latestRequest.current) setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <form className="space-y-4" noValidate onSubmit={submit}>
        <fieldset
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          disabled={pending}
        >
          <legend className="sr-only">Scenario feature values</legend>
          {fields.map(({ name, label, step }) => {
            const error = errors[name]?.message;
            const errorId = `${name}-price-impact-error`;
            return (
              <div key={name}>
                <label
                  className="block text-sm font-medium text-slate-700"
                  htmlFor={`${name}-price-impact`}
                >
                  {label}
                </label>
                <input
                  aria-describedby={error ? errorId : undefined}
                  aria-invalid={error ? "true" : "false"}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  id={`${name}-price-impact`}
                  inputMode="decimal"
                  step={step}
                  type="number"
                  {...register(name, { valueAsNumber: true })}
                />
                {error ? (
                  <p
                    className="mt-1 text-sm text-red-700"
                    id={errorId}
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
              </div>
            );
          })}
        </fieldset>

        {!hasEffectiveChange ? (
          <p className="text-sm text-slate-600">
            Change at least one feature to compare.
          </p>
        ) : null}
        <button
          className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={!hasEffectiveChange || pending}
          type="submit"
        >
          {pending ? "Comparing…" : "Compare price impact"}
        </button>
      </form>

      {requestError ? (
        <p
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-900"
          role="alert"
        >
          {requestError}
        </p>
      ) : null}
      {result ? <ImpactResult result={result} /> : null}
    </div>
  );
}
