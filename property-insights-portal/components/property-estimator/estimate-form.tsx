"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import {
  estimateErrorSchema,
  type ValidationIssue,
} from "@/lib/api-error-schema";
import { estimateResultSchema, propertySchema } from "@/lib/property-schema";
import type { EstimateResult, PropertyFeatures } from "@/lib/types";

const batchEstimateLimit = 20;

const defaults: PropertyFeatures = {
  square_footage: 1550,
  bedrooms: 3,
  bathrooms: 2,
  year_built: 1997,
  lot_size: 6800,
  distance_to_city_center: 4.1,
  school_rating: 7.6,
};

const fields: Array<{
  name: keyof PropertyFeatures;
  label: string;
  columnLabel: string;
  step: string;
}> = [
  {
    name: "square_footage",
    label: "Square footage",
    columnLabel: "Square footage",
    step: "1",
  },
  {
    name: "bedrooms",
    label: "Bedrooms",
    columnLabel: "Bedrooms",
    step: "1",
  },
  {
    name: "bathrooms",
    label: "Bathrooms",
    columnLabel: "Bathrooms",
    step: "0.5",
  },
  {
    name: "year_built",
    label: "Year built",
    columnLabel: "Year built",
    step: "1",
  },
  { name: "lot_size", label: "Lot size", columnLabel: "Lot size", step: "1" },
  {
    name: "distance_to_city_center",
    label: "Distance to city center",
    columnLabel: "Distance to city center",
    step: "0.1",
  },
  {
    name: "school_rating",
    label: "School rating",
    columnLabel: "School rating",
    step: "0.1",
  },
];

const propertyFieldNames = new Set<keyof PropertyFeatures>(
  fields.map((field) => field.name),
);

function findPropertyField(
  issue: ValidationIssue,
): keyof PropertyFeatures | null {
  for (let index = issue.loc.length - 1; index >= 0; index -= 1) {
    const segment = issue.loc[index];
    if (
      typeof segment === "string" &&
      propertyFieldNames.has(segment as keyof PropertyFeatures)
    ) {
      return segment as keyof PropertyFeatures;
    }
  }

  return null;
}

function mapServerFieldErrors(issues: ValidationIssue[]) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    const field = findPropertyField(issue);
    if (!field) {
      continue;
    }

    const propertyIndex = issue.loc.find(
      (segment): segment is number => typeof segment === "number",
    );
    const key = `${propertyIndex ?? 0}.${field}`;

    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.msg;
    }
  }

  return fieldErrors;
}

const estimateFormSchema = z.object({
  properties: z.array(propertySchema).min(1).max(batchEstimateLimit),
});

type EstimateFormValues = z.infer<typeof estimateFormSchema>;
type EstimateMode = "single" | "batch";

export function EstimateForm({
  onSuccessAction,
}: {
  onSuccessAction: (result: EstimateResult) => void;
}) {
  const [requestError, setRequestError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string>
  >({});
  const [mode, setMode] = useState<EstimateMode>("single");

  const {
    control,
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
  } = useForm<EstimateFormValues>({
    resolver: zodResolver(estimateFormSchema),
    defaultValues: { properties: [defaults] },
  });

  const {
    append,
    fields: propertyFields,
    remove,
    replace,
  } = useFieldArray({
    control,
    name: "properties",
  });

  function selectMode(nextMode: EstimateMode) {
    if (nextMode === "single" && propertyFields.length > 1) {
      replace([getValues("properties.0")]);
    }

    setMode(nextMode);
  }

  const submit = handleSubmit(async ({ properties }) => {
    setRequestError(null);
    setServerFieldErrors({});

    try {
      const response = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "single" ? properties[0] : properties),
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        const parsedError = estimateErrorSchema.safeParse(payload);
        if (!parsedError.success) {
          setRequestError("The estimate request failed.");
          return;
        }

        const mappedFieldErrors = mapServerFieldErrors(
          parsedError.data.fieldErrors ?? [],
        );
        setServerFieldErrors(mappedFieldErrors);
        setRequestError(
          Object.keys(mappedFieldErrors).length > 0
            ? "Please correct the highlighted fields."
            : parsedError.data.error,
        );
        return;
      }

      const parsed = estimateResultSchema.safeParse(payload);

      if (!parsed.success) {
        setRequestError("The estimate response was invalid.");
        return;
      }

      onSuccessAction(parsed.data);
    } catch {
      setRequestError("The estimate service is unavailable. Please try again.");
    }
  });

  return (
    <form
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      onSubmit={submit}
      noValidate
    >
      <div className="sticky top-0 z-10 -mx-2 flex flex-wrap items-end justify-between gap-4 rounded-xl bg-white/95 px-2 py-3 backdrop-blur">
        <fieldset className="flex flex-wrap gap-4" disabled={isSubmitting}>
          <legend className="mb-2 w-full text-sm font-semibold">
            Estimate mode
          </legend>

          <label className="flex items-center gap-2">
            <input
              checked={mode === "single"}
              name="estimate-mode"
              onChange={() => selectMode("single")}
              type="radio"
            />
            Single
          </label>

          <label className="flex items-center gap-2">
            <input
              checked={mode === "batch"}
              name="estimate-mode"
              onChange={() => selectMode("batch")}
              type="radio"
            />
            Batch
          </label>
        </fieldset>

        <div className="flex flex-wrap gap-3">
          {mode === "batch" ? (
            <button
              className="rounded-lg border border-blue-700 px-4 py-2 font-semibold text-blue-700 disabled:cursor-not-allowed disabled:border-slate-400 disabled:text-slate-400"
              disabled={
                isSubmitting || propertyFields.length >= batchEstimateLimit
              }
              onClick={() => append({ ...defaults })}
              type="button"
            >
              Add property
            </button>
          ) : null}

          <button
            className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting
              ? "Estimating…"
              : mode === "batch"
                ? `Estimate ${propertyFields.length} properties`
                : "Estimate value"}
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table
          aria-label="Property inputs"
          className="w-full min-w-255 border-separate border-spacing-0"
        >
          <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th
                className="whitespace-nowrap rounded-l-lg px-2 py-3"
                scope="col"
              >
                Property
              </th>
              {fields.map((field) => (
                <th
                  className="whitespace-nowrap px-1 py-3"
                  key={field.name}
                  scope="col"
                >
                  {field.columnLabel}
                </th>
              ))}
              <th className="rounded-r-lg px-2 py-3" scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {propertyFields.map((propertyField, index) => (
              <tr className="hover:bg-slate-50" key={propertyField.id}>
                <th
                  className="whitespace-nowrap border-b border-slate-200 px-2 py-3 text-left font-semibold align-middle"
                  scope="row"
                >
                  {mode === "batch" ? `Property ${index + 1}` : "Property"}
                </th>

                {fields.map((field) => {
                  const error = errors.properties?.[index]?.[field.name];
                  const inputId = `${field.name}-${index}`;
                  const errorId = `${inputId}-error`;
                  const serverFieldError =
                    serverFieldErrors[`${index}.${field.name}`];
                  const fieldError =
                    typeof error?.message === "string" && error.message
                      ? error.message
                      : serverFieldError;

                  return (
                    <td
                      className="border-b border-slate-200 px-1 py-3 align-top"
                      key={field.name}
                    >
                      <label className="sr-only" htmlFor={inputId}>
                        {field.label}
                      </label>

                      <input
                        aria-describedby={fieldError ? errorId : undefined}
                        aria-invalid={fieldError ? "true" : "false"}
                        className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        disabled={isSubmitting}
                        id={inputId}
                        inputMode="decimal"
                        step={field.step}
                        type="number"
                        {...register(
                          `properties.${index}.${field.name}` as const,
                          { valueAsNumber: true },
                        )}
                      />

                      {fieldError ? (
                        <p
                          className="mt-1 text-xs text-red-700"
                          id={errorId}
                          role="alert"
                        >
                          {fieldError}
                        </p>
                      ) : null}
                    </td>
                  );
                })}

                <td className="border-b border-slate-200 px-2 py-3 text-right align-middle">
                  {mode === "batch" && propertyFields.length > 1 ? (
                    <button
                      aria-label={`Remove property ${index + 1}`}
                      className="text-sm font-semibold text-red-700"
                      disabled={isSubmitting}
                      onClick={() => remove(index)}
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {requestError ? (
        <p
          className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {requestError}
        </p>
      ) : null}
    </form>
  );
}
