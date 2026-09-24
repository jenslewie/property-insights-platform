import { expect, test } from "vitest";

test("formats a stable numeric estimate label", async () => {
  const display = await import("./estimate-display").catch(() => null);
  const records = [{ display_number: 1 }, { display_number: 2 }];

  expect(display).not.toBeNull();
  expect(display?.formatEstimateLabel({ display_number: 108 })).toBe(
    "Estimate #108",
  );
  expect(records.map(display!.formatEstimateLabel)).toEqual([
    "Estimate #1",
    "Estimate #2",
  ]);
  expect([...records].reverse().map(display!.formatEstimateLabel)).toEqual([
    "Estimate #2",
    "Estimate #1",
  ]);
});
