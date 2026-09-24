import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import type { EstimateRecord } from "@/lib/types";
import { EstimateHistory } from "./estimate-history";

const record: EstimateRecord = {
  id: "estimate-108",
  display_number: 108,
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

function createRecords(count: number): EstimateRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    ...record,
    id: `estimate-${index}`,
    display_number: 108 - index,
    created_at: `2026-09-${String(24 - (index % 3)).padStart(2, "0")}T10:00:00.000Z`,
    property: {
      ...record.property,
      square_footage: 1200 + index,
    },
  }));
}

test("renders estimates in a compact table and lets the user select them", async () => {
  const onToggle = vi.fn();
  const onCompare = vi.fn();
  const user = userEvent.setup();

  render(
    <EstimateHistory
      history={[record]}
      onClear={vi.fn()}
      onClearSelection={vi.fn()}
      onCompare={onCompare}
      onRemove={vi.fn()}
      onToggle={onToggle}
      selectedIds={[]}
    />,
  );

  const table = screen.getByRole("table", {
    name: "Estimate history",
  }) as HTMLTableElement;
  expect(table).toHaveClass("xl:table-fixed");
  expect(table.parentElement).not.toHaveClass("overflow-x-auto");
  expect(table.tHead).toHaveClass("xl:not-sr-only");
  expect(table.tBodies[0]).toHaveClass("grid", "xl:table-row-group");
  expect(within(table).getByText("Estimate #108")).toBeInTheDocument();
  expect(within(table).getByText("250,879.73")).toBeInTheDocument();
  expect(
    within(table).getByRole("columnheader", { name: "Created" }),
  ).toBeInTheDocument();
  expect(screen.getByText("0 of 4 estimates selected")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Compare selected" }),
  ).toBeDisabled();
  const historyRow = within(table).getByRole("row", { name: /Estimate #108/ });
  expect(historyRow).toHaveClass("grid", "grid-cols-2", "xl:table-row");
  expect(
    historyRow.querySelector('[data-label="Predicted price"]'),
  ).toBeInTheDocument();
  expect(
    historyRow.querySelector('[data-label="Created"]'),
  ).toBeInTheDocument();

  await user.click(
    screen.getByRole("checkbox", {
      name: "Select Estimate #108 for comparison",
    }),
  );
  expect(onToggle).toHaveBeenCalledWith("estimate-108");
  expect(onCompare).not.toHaveBeenCalled();
});

test("paginates ten rows, retains selection across pages, and clamps after removal", async () => {
  const onCompare = vi.fn();
  const user = userEvent.setup();

  function StatefulHistory() {
    const [history, setHistory] = useState(createRecords(11));
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    return (
      <EstimateHistory
        history={history}
        onClear={() => setHistory([])}
        onClearSelection={() => setSelectedIds([])}
        onCompare={onCompare}
        onRemove={(id) =>
          setHistory((current) => current.filter((item) => item.id !== id))
        }
        onToggle={(id) =>
          setSelectedIds((current) =>
            current.includes(id)
              ? current.filter((selectedId) => selectedId !== id)
              : [...current, id],
          )
        }
        selectedIds={selectedIds}
      />
    );
  }

  render(<StatefulHistory />);

  expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  expect(screen.getAllByRole("row")).toHaveLength(11);

  await user.click(screen.getByRole("button", { name: "Next page" }));
  expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  expect(screen.getByRole("row", { name: /Estimate #98/ })).toBeInTheDocument();
  const lastPageCheckbox = screen.getByRole("checkbox", {
    name: "Select Estimate #98 for comparison",
  });
  await user.click(lastPageCheckbox);

  await user.click(screen.getByRole("button", { name: "Previous page" }));
  await user.click(screen.getByRole("button", { name: "Next page" }));
  expect(
    screen.getByRole("checkbox", {
      name: "Select Estimate #98 for comparison",
    }),
  ).toBeChecked();

  const lastPageRow = screen.getByRole("row", { name: /Estimate #98/ });
  await user.click(within(lastPageRow).getByText("⋯"));
  await user.click(screen.getByRole("button", { name: "Remove Estimate #98" }));
  expect(
    screen.queryByRole("navigation", { name: "Estimate history pagination" }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByRole("row")).toHaveLength(11);
  expect(screen.queryByText("Estimate #98")).not.toBeInTheDocument();
});

test("shows the full property snapshot from the row actions", async () => {
  const user = userEvent.setup();

  render(
    <EstimateHistory
      history={[record]}
      onClear={vi.fn()}
      onClearSelection={vi.fn()}
      onCompare={vi.fn()}
      onRemove={vi.fn()}
      onToggle={vi.fn()}
      selectedIds={[]}
    />,
  );

  await user.click(screen.getByText("⋯"));
  await user.click(
    screen.getByRole("button", { name: "View details for Estimate #108" }),
  );

  const details = screen.getByRole("region", { name: "Estimate #108 details" });
  expect(within(details).getByText("Square footage")).toBeInTheDocument();
  expect(within(details).getByText("1,550")).toBeInTheDocument();
  expect(within(details).getByText("Bedrooms")).toBeInTheDocument();
  expect(within(details).getByText("Bathrooms")).toBeInTheDocument();
  expect(within(details).getByText("Year built")).toBeInTheDocument();
  expect(within(details).getByText("Lot size")).toBeInTheDocument();
  expect(
    within(details).getByText("Distance to city center"),
  ).toBeInTheDocument();
  expect(within(details).getByText("School rating")).toBeInTheDocument();
  expect(within(details).getByText("250,879.73")).toBeInTheDocument();
});

test("limits selection to four and exposes clear-selection and compare actions", async () => {
  const history = createRecords(5);
  const onClearSelection = vi.fn();
  const onCompare = vi.fn();
  const user = userEvent.setup();

  const { rerender } = render(
    <EstimateHistory
      history={history}
      onClear={vi.fn()}
      onClearSelection={onClearSelection}
      onCompare={onCompare}
      onRemove={vi.fn()}
      onToggle={vi.fn()}
      selectedIds={history.slice(0, 4).map(({ id }) => id)}
    />,
  );

  expect(screen.getByText("4 of 4 estimates selected")).toBeInTheDocument();
  expect(
    screen.getByRole("checkbox", {
      name: "Select Estimate #104 for comparison",
    }),
  ).toBeDisabled();

  await user.click(screen.getByRole("button", { name: "Clear selection" }));
  expect(onClearSelection).toHaveBeenCalledOnce();

  rerender(
    <EstimateHistory
      history={history}
      onClear={vi.fn()}
      onClearSelection={onClearSelection}
      onCompare={onCompare}
      onRemove={vi.fn()}
      onToggle={vi.fn()}
      selectedIds={history.slice(0, 2).map(({ id }) => id)}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Compare selected" }),
  ).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Compare selected" }));
  expect(onCompare).toHaveBeenCalledOnce();
});

test("requires confirmation before clearing all history", async () => {
  const onClear = vi.fn();
  const user = userEvent.setup();

  render(
    <EstimateHistory
      history={[record]}
      onClear={onClear}
      onClearSelection={vi.fn()}
      onCompare={vi.fn()}
      onRemove={vi.fn()}
      onToggle={vi.fn()}
      selectedIds={[]}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Clear history" }));
  expect(screen.getByText("Clear all estimate history?")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onClear).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Clear history" }));
  await user.click(
    screen.getByRole("button", { name: "Confirm clear history" }),
  );
  expect(onClear).toHaveBeenCalledOnce();
});
