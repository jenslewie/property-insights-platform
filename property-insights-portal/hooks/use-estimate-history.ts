"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  estimateHistoryStateSchema,
  legacyEstimateHistorySchema,
} from "@/lib/property-schema";
import { MAX_COMPARISON_ESTIMATES } from "@/lib/estimate-constants";
import type { EstimateRecord, EstimateResponse } from "@/lib/types";

const legacyStorageKey = "property-estimates:v1";
const storageKey = "property-estimates:v2";
const historyChangeEvent = "property-estimates-change";

function getClientSnapshot() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const current = window.localStorage.getItem(storageKey);
    if (current !== null) {
      return `v2:${current}`;
    }

    return `v1:${window.localStorage.getItem(legacyStorageKey) ?? ""}`;
  } catch {
    return "v2:";
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

type EstimateHistoryState = {
  next_number: number;
  records: EstimateRecord[];
};

function emptyHistory(): EstimateHistoryState {
  return { next_number: 1, records: [] };
}

function parseHistory(snapshot: string | null): EstimateHistoryState {
  if (!snapshot) {
    return emptyHistory();
  }

  try {
    const separator = snapshot.indexOf(":");
    const version = snapshot.slice(0, separator);
    const raw = snapshot.slice(separator + 1);
    const data = JSON.parse(raw);

    if (version === "v2") {
      const parsed = estimateHistoryStateSchema.safeParse(data);
      return parsed.success ? parsed.data : emptyHistory();
    }

    if (version === "v1") {
      const parsed = legacyEstimateHistorySchema.safeParse(data);
      if (!parsed.success) {
        return emptyHistory();
      }

      const records = parsed.data.map((record, index) => ({
        ...record,
        display_number: parsed.data.length - index,
      }));

      return { next_number: records.length + 1, records };
    }

    return emptyHistory();
  } catch {
    return emptyHistory();
  }
}

function readHistoryStateFromStorage() {
  return parseHistory(getClientSnapshot());
}

function writeHistoryState(state: EstimateHistoryState) {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
  window.dispatchEvent(new Event(historyChangeEvent));
}

function createEstimateRecord(
  estimate: EstimateResponse,
  display_number: number,
): EstimateRecord {
  return {
    ...estimate,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    display_number,
  };
}

export function useEstimateHistory() {
  const rawHistory = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const historyState = useMemo(() => parseHistory(rawHistory), [rawHistory]);
  const history = historyState.records;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const historyIds = useMemo(
    () => new Set(history.map((record) => record.id)),
    [history],
  );
  const visibleSelectedIds = useMemo(
    () => selectedIds.filter((id) => historyIds.has(id)),
    [historyIds, selectedIds],
  );
  const isHydrated = rawHistory !== null;

  const addEstimate = useCallback((estimate: EstimateResponse) => {
    const current = readHistoryStateFromStorage();
    const record = createEstimateRecord(estimate, current.next_number);

    writeHistoryState({
      next_number: current.next_number + 1,
      records: [record, ...current.records],
    });

    return record;
  }, []);

  const addEstimates = useCallback((estimates: EstimateResponse[]) => {
    const current = readHistoryStateFromStorage();
    const records = estimates.map((estimate, index) =>
      createEstimateRecord(estimate, current.next_number + index),
    );

    writeHistoryState({
      next_number: current.next_number + records.length,
      records: [...records, ...current.records],
    });

    return records;
  }, []);

  const removeEstimate = useCallback((id: string) => {
    const current = readHistoryStateFromStorage();
    writeHistoryState({
      ...current,
      records: current.records.filter((record) => record.id !== id),
    });
    setSelectedIds((current) =>
      current.filter((selectedId) => selectedId !== id),
    );
  }, []);

  const clearHistory = useCallback(() => {
    const current = readHistoryStateFromStorage();
    writeHistoryState({ ...current, records: [] });
    setSelectedIds([]);
  }, []);

  const toggleSelected = useCallback(
    (id: string) => {
      if (!historyIds.has(id)) {
        return;
      }

      setSelectedIds((current) => {
        const validSelection = current.filter((selectedId) =>
          historyIds.has(selectedId),
        );
        if (validSelection.includes(id)) {
          return validSelection.filter((selectedId) => selectedId !== id);
        }

        if (validSelection.length >= MAX_COMPARISON_ESTIMATES) {
          return validSelection;
        }

        return [...validSelection, id];
      });
    },
    [historyIds],
  );

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const selectedRecords = useMemo(
    () =>
      visibleSelectedIds.flatMap(
        (id) => history.find((record) => record.id === id) ?? [],
      ),
    [history, visibleSelectedIds],
  );

  return {
    history,
    isHydrated,
    selectedIds: visibleSelectedIds,
    selectedRecords,
    clearSelection,
    addEstimate,
    addEstimates,
    removeEstimate,
    clearHistory,
    toggleSelected,
  };
}
