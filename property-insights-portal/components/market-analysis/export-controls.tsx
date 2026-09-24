"use client";

import { useEffect, useRef, useState } from "react";
import {
  conditionSearchParams,
  type MarketScenario,
} from "@/lib/market-analysis/filters";
import type { SegmentFilters } from "@/lib/market-analysis/fields";

type ExportFormat = "csv" | "pdf";

type Props = {
  filters: SegmentFilters;
  scenario?: MarketScenario;
  matchedCount: number;
  segmentReady?: boolean;
};

const exportOptions: Record<
  ExportFormat,
  { mediaType: string; label: string }
> = {
  csv: {
    mediaType: "text/csv",
    label: "CSV",
  },
  pdf: {
    mediaType: "application/pdf",
    label: "PDF",
  },
};

function safeFilename(
  value: string | null,
  format: ExportFormat,
): string | null {
  if (!value) return null;
  const match =
    /^attachment;\s*filename=(property-market-analysis_[a-f0-9]{8}\.(csv|pdf))$/i.exec(
      value,
    );
  return match && match[2] === format ? match[1] : null;
}

export function ExportControls({
  filters,
  scenario,
  matchedCount,
  segmentReady = true,
}: Props) {
  const [pending, setPending] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (menuOpen) firstOptionRef.current?.focus();
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    triggerRef.current?.focus();
  }

  async function download(format: ExportFormat) {
    if (!segmentReady || pending || matchedCount === 0) return;
    setMenuOpen(false);
    triggerRef.current?.focus();
    const option = exportOptions[format];
    const query = new URLSearchParams({ format });
    conditionSearchParams(filters, scenario).forEach((value, key) =>
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

      const filename = safeFilename(
        response.headers.get("Content-Disposition"),
        format,
      );
      if (!filename) {
        setError("The export could not be downloaded.");
        return;
      }

      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
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

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    }
  }

  function optionButton(
    format: ExportFormat,
    title: string,
    description: string,
    ref?: React.RefObject<HTMLButtonElement | null>,
  ) {
    return (
      <button
        aria-busy={pending === format}
        className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!segmentReady || matchedCount === 0 || pending !== null}
        onClick={() => void download(format)}
        ref={ref}
        role="menuitem"
        type="button"
      >
        <span className="font-semibold text-slate-900">{title}</span>
        <span className="text-sm text-slate-600">{description}</span>
      </button>
    );
  }

  return (
    <div className="relative flex flex-col items-start">
      <button
        aria-disabled={!segmentReady}
        aria-controls="market-export-menu"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        onClick={() => {
          if (segmentReady) setMenuOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (segmentReady && event.key === "ArrowDown") {
            event.preventDefault();
            setMenuOpen(true);
          }
        }}
        ref={triggerRef}
        type="button"
      >
        Export
      </button>
      <div
        className="absolute left-0 top-full z-20 mt-2 min-w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
        hidden={!menuOpen}
        id="market-export-menu"
        onKeyDown={handleMenuKeyDown}
        role="menu"
      >
        {optionButton(
          "csv",
          "Properties CSV",
          "Filtered property data",
          firstOptionRef,
        )}
        {optionButton(
          "pdf",
          "Market analysis PDF",
          "Market summary and what-if analysis",
        )}
      </div>
      {pending ? (
        <p className="sr-only" role="status">
          Preparing {exportOptions[pending].label} export.
        </p>
      ) : null}
      {error ? (
        <p
          className="absolute left-0 top-full z-10 mt-2 min-w-64 rounded-lg border border-red-300 bg-red-50 p-3 text-red-900 shadow-lg"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
