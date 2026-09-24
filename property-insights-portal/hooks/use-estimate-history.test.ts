import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";
import { useEstimateHistory } from "./use-estimate-history";

const estimate = {
  property: {
    square_footage: 1550,
    bedrooms: 3,
    bathrooms: 2,
    year_built: 1997,
    lot_size: 6800,
    distance_to_city_center: 4.1,
    school_rating: 7.6,
  },
  predicted_price: 250879.73,
};

const secondEstimate = {
  property: {
    square_footage: 2200,
    bedrooms: 4,
    bathrooms: 2.5,
    year_built: 2008,
    lot_size: 9600,
    distance_to_city_center: 7,
    school_rating: 8.8,
  },
  predicted_price: 364551.64,
};

test("ignores malformed persisted data", async () => {
  localStorage.setItem("property-estimates:v1", "not-json");

  const { result } = renderHook(() => useEstimateHistory());

  await waitFor(() => expect(result.current.isHydrated).toBe(true));

  expect(result.current.history).toEqual([]);
});

test("adds, persists, selects, removes, and clears estimates", async () => {
  const { result } = renderHook(() => useEstimateHistory());

  await waitFor(() => expect(result.current.isHydrated).toBe(true));

  act(() => result.current.addEstimate(estimate));

  expect(result.current.history).toHaveLength(1);
  expect(
    JSON.parse(localStorage.getItem("property-estimates:v2") ?? "{}").records,
  ).toHaveLength(1);

  const id = result.current.history[0].id;

  act(() => result.current.toggleSelected(id));
  expect(result.current.selectedRecords).toHaveLength(1);

  act(() => result.current.removeEstimate(id));
  expect(result.current.history).toEqual([]);

  act(() => result.current.addEstimate(estimate));
  act(() => result.current.clearHistory());

  expect(result.current.history).toEqual([]);
  expect(result.current.selectedIds).toEqual([]);
});

test("allocates numeric IDs without reusing numbers after deletion or clear", async () => {
  const { result } = renderHook(() => useEstimateHistory());

  await waitFor(() => expect(result.current.isHydrated).toBe(true));

  let first:
    (typeof estimate & { id: string; display_number: number }) | undefined;
  let second: typeof first;
  act(() => {
    first = result.current.addEstimate(estimate);
    second = result.current.addEstimate(secondEstimate);
  });

  expect(first?.display_number).toBe(1);
  expect(second?.display_number).toBe(2);
  expect(
    JSON.parse(localStorage.getItem("property-estimates:v2") ?? "{}"),
  ).toMatchObject({
    next_number: 3,
  });

  act(() => result.current.removeEstimate(first!.id));
  act(() => result.current.clearHistory());
  act(() => result.current.addEstimate(estimate));

  expect(result.current.history[0].display_number).toBe(3);
});

test("migrates existing v1 history and continues its numeric IDs", async () => {
  localStorage.setItem(
    "property-estimates:v1",
    JSON.stringify([
      { ...estimate, id: "newer", created_at: "2026-09-24T10:00:00.000Z" },
      {
        ...secondEstimate,
        id: "older",
        created_at: "2026-09-23T10:00:00.000Z",
      },
    ]),
  );

  const { result } = renderHook(() => useEstimateHistory());

  await waitFor(() => expect(result.current.isHydrated).toBe(true));

  expect(result.current.history.map((record) => record.display_number)).toEqual(
    [2, 1],
  );

  let added:
    (typeof estimate & { id: string; display_number: number }) | undefined;
  act(() => {
    added = result.current.addEstimate(estimate);
  });

  expect(added?.display_number).toBe(3);
  expect(
    JSON.parse(localStorage.getItem("property-estimates:v2") ?? "{}").records,
  ).toHaveLength(3);
});

test("hydrates persisted display numbers unchanged after a refresh", async () => {
  const savedRecords = [
    {
      ...estimate,
      id: "newer-record",
      created_at: "2026-09-24T10:00:00.000Z",
      display_number: 12,
    },
    {
      ...secondEstimate,
      id: "older-record",
      created_at: "2026-09-23T10:00:00.000Z",
      display_number: 10,
    },
  ];
  localStorage.setItem(
    "property-estimates:v2",
    JSON.stringify({ next_number: 13, records: savedRecords }),
  );

  const firstRender = renderHook(() => useEstimateHistory());
  await waitFor(() => expect(firstRender.result.current.isHydrated).toBe(true));
  expect(
    firstRender.result.current.history.map(
      ({ display_number }) => display_number,
    ),
  ).toEqual([12, 10]);
  firstRender.unmount();

  const refreshed = renderHook(() => useEstimateHistory());
  await waitFor(() => expect(refreshed.result.current.isHydrated).toBe(true));
  expect(
    refreshed.result.current.history.map(({ id, display_number }) => [
      id,
      display_number,
    ]),
  ).toEqual([
    ["newer-record", 12],
    ["older-record", 10],
  ]);

  let added:
    ReturnType<typeof refreshed.result.current.addEstimate> | undefined;
  act(() => {
    added = refreshed.result.current.addEstimate(estimate);
  });
  expect(added?.display_number).toBe(13);
});

test("does not fall back to stale v1 history when v2 storage is malformed", async () => {
  localStorage.setItem(
    "property-estimates:v1",
    JSON.stringify([
      { ...estimate, id: "old", created_at: "2026-09-23T10:00:00.000Z" },
    ]),
  );
  localStorage.setItem("property-estimates:v2", "not-json");

  const { result } = renderHook(() => useEstimateHistory());

  await waitFor(() => expect(result.current.isHydrated).toBe(true));

  expect(result.current.history).toEqual([]);
});

test("batch additions allocate consecutive IDs and do not auto-select", async () => {
  const { result } = renderHook(() => useEstimateHistory());

  await waitFor(() => expect(result.current.isHydrated).toBe(true));

  let added: ReturnType<typeof result.current.addEstimates> = [];
  act(() => {
    added = result.current.addEstimates([estimate, secondEstimate]);
  });

  expect(added.map((record) => record.display_number)).toEqual([1, 2]);
  expect(result.current.selectedIds).toEqual([]);
});

test("selection stops at four and allows deselecting before adding another", async () => {
  const { result } = renderHook(() => useEstimateHistory());

  await waitFor(() => expect(result.current.isHydrated).toBe(true));

  let records: ReturnType<typeof result.current.addEstimates> = [];
  act(() => {
    records = result.current.addEstimates([
      estimate,
      secondEstimate,
      estimate,
      secondEstimate,
      estimate,
    ]);
  });

  act(() =>
    records.slice(0, 4).forEach(({ id }) => result.current.toggleSelected(id)),
  );
  act(() => result.current.toggleSelected(records[4].id));
  expect(result.current.selectedIds).toHaveLength(4);
  expect(result.current.selectedIds).not.toContain(records[4].id);

  act(() => result.current.toggleSelected(records[0].id));
  act(() => result.current.toggleSelected(records[4].id));
  expect(result.current.selectedIds).toHaveLength(4);
  expect(result.current.selectedIds).toContain(records[4].id);
});

test("adds a batch in request order without changing selection", async () => {
  const { result } = renderHook(() => useEstimateHistory());

  await waitFor(() => expect(result.current.isHydrated).toBe(true));

  act(() => result.current.addEstimates([estimate, secondEstimate]));

  expect(
    result.current.history.map((record) => record.predicted_price),
  ).toEqual([250879.73, 364551.64]);
  expect(result.current.selectedRecords).toEqual([]);
  expect(
    JSON.parse(localStorage.getItem("property-estimates:v2") ?? "{}").records,
  ).toHaveLength(2);
});
