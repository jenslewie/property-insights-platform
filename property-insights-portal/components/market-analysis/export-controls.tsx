"use client";

import { useState } from "react";
import { filterSearchParams } from "@/lib/market-analysis/filters";
import type { SegmentFilters } from "@/lib/market-analysis/fields";

type ExportFormat = "csv" | "pdf";

type Props = {
  filters: SegmentFilters;
  matchedCount: number;
};

const exportOptions: Record<
  ExportFormat,
  {
    type: "data" | "report";
    mediaType: string;
    filename: string;
    label: string;
  }
> = {
  csv: {
    type: "data",
    mediaType: "text/csv",
    filename: "properties.csv",
    label: "CSV",
  },
  pdf: {
    type: "report",
    mediaType: "application/pdf",
    filename: "market-report.pdf",
    label: "PDF",
  },
};

export function ExportControls({ filters, matchedCount }: Props) {
  const [pending, setPending] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(format: ExportFormat) {
    if (pending || matchedCount === 0) return;
    const option = exportOptions[format];
    const query = new URLSearchParams({ type: option.type, format });
    filterSearchParams(filters).forEach((value, key) =>
      query.append(key, value),
    );

    setPending(format);
    setError(null);
    try {
      const response = await fetch(
        `/api/market-analysis/export?${query.toString()}`,
      );
      if (!response.ok) {
        setError(
          response.status === 404
            ? "This segment no longer has exportable records."
            : "The export could not be downloaded.",
        );
        return;
      }

      const mediaType = response.headers
        .get("Content-Type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase();
      if (mediaType !== option.mediaType) {
        setError("The export could not be downloaded.");
        return;
      }

      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = option.filename;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      setError("The export could not be downloaded.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      aria-labelledby="market-export-heading"
      className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold" id="market-export-heading">
          Export this segment
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Local table search, sorting, and pagination do not change exports.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          aria-busy={pending === "csv"}
          className="rounded-lg border border-blue-700 px-4 py-2 font-semibold text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-400 disabled:text-slate-400"
          disabled={matchedCount === 0 || pending !== null}
          onClick={() => void download("csv")}
          type="button"
        >
          {pending === "csv" ? "Preparing CSV…" : "Export segment CSV"}
        </button>
        <button
          aria-busy={pending === "pdf"}
          className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={matchedCount === 0 || pending !== null}
          onClick={() => void download("pdf")}
          type="button"
        >
          {pending === "pdf" ? "Preparing PDF…" : "Export segment PDF"}
        </button>
      </div>
      {pending ? (
        <p className="sr-only" role="status">
          Preparing {exportOptions[pending].label} export.
        </p>
      ) : null}
      {error ? (
        <p
          className="w-full rounded-lg border border-red-300 bg-red-50 p-3 text-red-900"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
