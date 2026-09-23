"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { estimateHistorySchema } from "@/lib/property-schema";
import type { EstimateRecord, EstimateResponse } from "@/lib/types";

const storageKey = "property-estimates:v1";
const historyChangeEvent = "property-estimates-change";

function getClientSnapshot() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot() {
  return null;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(historyChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(historyChangeEvent, onStoreChange);
  };
}

function parseHistory(raw: string | null) {
  if (!raw) {
    return [];
  }

  try {
    const parsed = estimateHistorySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function readHistoryFromStorage() {
  return parseHistory(getClientSnapshot());
}

function writeHistory(history: EstimateRecord[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(history));
  window.dispatchEvent(new Event(historyChangeEvent));
}

function createEstimateRecord(estimate: EstimateResponse): EstimateRecord {
  return {
    ...estimate,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
}

export function useEstimateHistory() {
  const rawHistory = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const history = useMemo(() => parseHistory(rawHistory), [rawHistory]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isHydrated = rawHistory !== null;

  const addEstimate = useCallback((estimate: EstimateResponse) => {
    const record = createEstimateRecord(estimate);

    writeHistory([record, ...readHistoryFromStorage()]);
  }, []);

  const addEstimates = useCallback((estimates: EstimateResponse[]) => {
    const records = estimates.map(createEstimateRecord);

    writeHistory([...records, ...readHistoryFromStorage()]);
    setSelectedIds(records.map((record) => record.id));
  }, []);

  const removeEstimate = useCallback((id: string) => {
    writeHistory(readHistoryFromStorage().filter((record) => record.id !== id));
    setSelectedIds((current) =>
      current.filter((selectedId) => selectedId !== id),
    );
  }, []);

  const clearHistory = useCallback(() => {
    writeHistory([]);
    setSelectedIds([]);
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }, []);

  const selectedRecords = useMemo(
    () =>
      selectedIds.flatMap(
        (id) => history.find((record) => record.id === id) ?? [],
      ),
    [history, selectedIds],
  );

  return {
    history,
    isHydrated,
    selectedIds,
    selectedRecords,
    addEstimate,
    addEstimates,
    removeEstimate,
    clearHistory,
    toggleSelected,
  };
}
