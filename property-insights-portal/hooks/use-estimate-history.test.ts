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
    JSON.parse(localStorage.getItem("property-estimates:v1") ?? "[]"),
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

test("adds and selects a batch of estimates in request order", async () => {
  const { result } = renderHook(() => useEstimateHistory());

  await waitFor(() => expect(result.current.isHydrated).toBe(true));

  act(() => {
    const history = result.current as typeof result.current & {
      addEstimates: (estimates: Array<typeof estimate>) => void;
    };
    history.addEstimates([estimate, secondEstimate]);
  });

  expect(
    result.current.history.map((record) => record.predicted_price),
  ).toEqual([250879.73, 364551.64]);
  expect(
    result.current.selectedRecords.map((record) => record.predicted_price),
  ).toEqual([250879.73, 364551.64]);
  expect(
    JSON.parse(localStorage.getItem("property-estimates:v1") ?? "[]"),
  ).toHaveLength(2);
});
