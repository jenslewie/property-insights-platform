import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { PropertyTable } from "./property-table";
import type { PropertyRecord } from "@/lib/market-analysis/schemas";

function property(id: number, price: number): PropertyRecord {
  return {
    id,
    square_footage: 1500 + id,
    bedrooms: 3,
    bathrooms: 2,
    year_built: 1990 + id,
    lot_size: 6000 + id,
    distance_to_city_center: 4,
    school_rating: 7,
    price,
  };
}

test("applies inclusive segment bounds and local text search", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(
    <PropertyTable
      properties={[
        property(1, 199999),
        property(2, 200000),
        property(3, 1000000),
      ]}
      filters={{ min_price: 200000 }}
      onSelect={onSelect}
    />,
  );

  expect(screen.getByText("200,000")).toBeInTheDocument();
  expect(screen.queryByText("199,999")).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("Search properties"), "1000000");
  expect(
    screen.getByText("1 property shown of 2 in this segment."),
  ).toBeInTheDocument();
  expect(screen.getByText("1,000,000")).toBeInTheDocument();
  expect(screen.queryByText("200,000")).not.toBeInTheDocument();
});

test("sorts numeric prices and marks the active sort direction", async () => {
  const user = userEvent.setup();
  render(
    <PropertyTable
      properties={[
        property(1, 1000000),
        property(2, 90000),
        property(3, 200000),
      ]}
      filters={{}}
      onSelect={vi.fn()}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Sort by price" }));

  const rows = screen.getAllByRole("row").slice(1);
  expect(
    rows.map((row) => within(row).getByRole("rowheader").textContent),
  ).toEqual(["Property 2", "Property 3", "Property 1"]);
  expect(screen.getByRole("columnheader", { name: /price/i })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
});

test("paginates eleven matching rows and resets pagination after a search", async () => {
  const user = userEvent.setup();
  render(
    <PropertyTable
      properties={Array.from({ length: 11 }, (_, index) =>
        property(index + 1, 200000 + index),
      )}
      filters={{}}
      onSelect={vi.fn()}
    />,
  );

  const firstPageFirstRow = screen.getAllByRole("row")[1];
  expect(within(firstPageFirstRow).getByRole("rowheader")).toHaveTextContent(
    "Property 1",
  );
  expect(within(firstPageFirstRow).getByText("200,000")).toBeInTheDocument();
  expect(
    screen.queryByRole("row", { name: /property 11/i }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Next page" }));
  expect(
    within(screen.getAllByRole("row")[1]).getByRole("rowheader"),
  ).toHaveTextContent("Property 11");
  await user.type(screen.getByLabelText("Search properties"), "200010");
  expect(screen.getByText(/page 1 of 1/i)).toBeInTheDocument();
  expect(
    within(screen.getAllByRole("row")[1]).getByRole("rowheader"),
  ).toHaveTextContent("Property 11");
});

test("selects a row and explains an empty segment", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const rows = [property(1, 200000), property(2, 250000)];
  const { rerender } = render(
    <PropertyTable properties={rows} filters={{}} onSelect={onSelect} />,
  );

  await user.click(
    screen.getByRole("button", { name: "Compare price impact for property 2" }),
  );
  expect(onSelect).toHaveBeenCalledWith(rows[1]);

  rerender(
    <PropertyTable
      properties={rows}
      filters={{ min_price: 999999 }}
      onSelect={onSelect}
    />,
  );
  expect(
    screen.getByText("No properties match the current table filters."),
  ).toBeInTheDocument();
});
