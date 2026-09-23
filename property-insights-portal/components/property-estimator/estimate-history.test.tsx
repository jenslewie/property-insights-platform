import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { EstimateHistory } from "./estimate-history";

const record = {
  id: "estimate-1",
  created_at: "2026-09-22T10:00:00.000Z",
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

test("selects and removes a saved estimate", async () => {
  const onToggle = vi.fn();
  const onRemove = vi.fn();
  const user = userEvent.setup();

  render(
    <EstimateHistory
      history={[record]}
      onClear={vi.fn()}
      onRemove={onRemove}
      onToggle={onToggle}
      selectedIds={[]}
    />,
  );

  expect(screen.getByText("250,879.73")).toBeInTheDocument();
  expect(
    screen.getByText("Square footage: 1,550 · 3 bedrooms"),
  ).toBeInTheDocument();

  await user.click(screen.getByRole("checkbox", { name: /compare estimate/i }));
  expect(onToggle).toHaveBeenCalledWith("estimate-1");

  await user.click(screen.getByRole("button", { name: /remove estimate/i }));
  expect(onRemove).toHaveBeenCalledWith("estimate-1");
});
