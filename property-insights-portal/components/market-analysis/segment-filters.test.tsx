import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { SegmentFiltersForm } from "./segment-filters";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockReset();
});

function renderFilters(
  filters: Parameters<typeof SegmentFiltersForm>[0]["filters"] = {},
  scenario?: Parameters<typeof SegmentFiltersForm>[0]["scenario"],
  dimension: Parameters<
    typeof SegmentFiltersForm
  >[0]["dimension"] = "square_footage",
) {
  return render(
    <SegmentFiltersForm
      filters={filters}
      scenario={scenario}
      dimension={dimension}
    />,
  );
}

test("keeps filter controls in a drawer until the dashboard action is opened", async () => {
  const user = userEvent.setup();
  renderFilters({ min_bedrooms: 3, min_bathrooms: 3 });

  expect(
    screen.queryByRole("dialog", { name: "Filters" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Filters (2)" }));

  expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
  expect(screen.getByLabelText("Minimum bedrooms")).toHaveValue(3);
  expect(screen.getByLabelText("Maximum bedrooms")).toHaveValue(null);
  expect(
    screen.getByRole("button", { name: "Close Filters" }),
  ).toBeInTheDocument();
});

test("cancel discards filter draft without changing the applied URL", async () => {
  const user = userEvent.setup();
  renderFilters({ min_bedrooms: 3 });

  await user.click(screen.getByRole("button", { name: "Filters (1)" }));
  await user.clear(screen.getByLabelText("Minimum bedrooms"));
  await user.type(screen.getByLabelText("Minimum bedrooms"), "4");
  await user.click(screen.getByRole("button", { name: "Cancel" }));

  expect(push).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Filters (1)" }));
  expect(screen.getByLabelText("Minimum bedrooms")).toHaveValue(3);
});

test("focuses the first filter input and returns focus to its trigger", async () => {
  const user = userEvent.setup();
  renderFilters();

  const trigger = screen.getByRole("button", { name: "Filters (0)" });
  await user.click(trigger);
  const firstInput = screen.getByLabelText("Minimum square footage");
  expect(firstInput).toHaveFocus();

  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(trigger).toHaveFocus();
});

test("applies active bounds to a shareable URL and closes the drawer", async () => {
  const user = userEvent.setup();
  renderFilters({}, { schoolRatingDelta: 1 }, "bedrooms");

  await user.click(screen.getByRole("button", { name: "Filters (0)" }));
  await user.type(screen.getByLabelText("Minimum price"), "200000");
  await user.type(screen.getByLabelText("Maximum price"), "300000");
  await user.click(screen.getByRole("button", { name: "Apply filters" }));

  expect(push).toHaveBeenCalledWith(
    "/market-analysis?min_price=200000&max_price=300000&scenario_school_rating_delta=1&chart_dimension=bedrooms",
  );
  expect(
    screen.queryByRole("dialog", { name: "Filters" }),
  ).not.toBeInTheDocument();
});

test("shows an inverted range error without navigating", async () => {
  const user = userEvent.setup();
  renderFilters();

  await user.click(screen.getByRole("button", { name: "Filters (0)" }));
  await user.type(screen.getByLabelText("Minimum price"), "300000");
  await user.type(screen.getByLabelText("Maximum price"), "200000");
  await user.click(screen.getByRole("button", { name: "Apply filters" }));

  expect(screen.getByRole("alert")).toHaveTextContent(/minimum.*maximum/i);
  expect(push).not.toHaveBeenCalled();
});

test("reset clears filters while keeping scenario and chart dimension", async () => {
  const user = userEvent.setup();
  renderFilters({ min_price: 200000 }, { squareFootagePercent: 5 }, "bedrooms");

  await user.click(screen.getByRole("button", { name: "Filters (1)" }));
  await user.click(screen.getByRole("button", { name: "Reset filters" }));

  expect(push).toHaveBeenCalledWith(
    "/market-analysis?scenario_square_footage_percent=5&chart_dimension=bedrooms",
  );
});

test("reset clears draft conditions when no filters are currently applied", async () => {
  const user = userEvent.setup();
  renderFilters();

  await user.click(screen.getByRole("button", { name: "Filters (0)" }));
  await user.type(screen.getByLabelText("Minimum bedrooms"), "4");
  await user.click(screen.getByRole("button", { name: "Reset filters" }));

  expect(screen.getByLabelText("Minimum bedrooms")).toHaveValue(null);
  expect(push).not.toHaveBeenCalled();
});

test("removes only the selected applied filter chip", async () => {
  const user = userEvent.setup();
  renderFilters(
    { min_bedrooms: 3, max_bedrooms: 5, min_bathrooms: 2 },
    { schoolRatingDelta: 1 },
    "bedrooms",
  );

  expect(screen.getByText("Bedrooms ≥ 3")).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Remove filter Bedrooms ≥ 3" }),
  );

  expect(push).toHaveBeenCalledWith(
    "/market-analysis?max_bedrooms=5&min_bathrooms=2&scenario_school_rating_delta=1&chart_dimension=bedrooms",
  );
});

test("restores the filter draft after applied filters change", async () => {
  const user = userEvent.setup();
  let updateFilters: ((filters: { min_bedrooms: number }) => void) | undefined;
  function Harness() {
    const [filters, setFilters] = useState({ min_bedrooms: 3 });
    updateFilters = setFilters;
    return <SegmentFiltersForm filters={filters} dimension="square_footage" />;
  }
  render(<Harness />);

  await user.click(screen.getByRole("button", { name: "Filters (1)" }));
  await user.clear(screen.getByLabelText("Minimum bedrooms"));
  await user.type(screen.getByLabelText("Minimum bedrooms"), "9");
  await act(async () => {
    updateFilters?.({ min_bedrooms: 4 });
  });
  await user.click(screen.getByRole("button", { name: "Filters (1)" }));

  expect(screen.getByLabelText("Minimum bedrooms")).toHaveValue(4);
  expect(screen.getByText("Bedrooms ≥ 4")).toBeInTheDocument();
});

test("keeps filter trigger focused after applying updated conditions", async () => {
  const user = userEvent.setup();
  const view = renderFilters();
  const trigger = screen.getByRole("button", { name: "Filters (0)" });

  await user.click(trigger);
  await user.type(screen.getByLabelText("Minimum price"), "200000");
  await user.click(screen.getByRole("button", { name: "Apply filters" }));
  view.rerender(
    <SegmentFiltersForm
      filters={{ min_price: 200000 }}
      dimension="square_footage"
    />,
  );

  expect(screen.getByRole("button", { name: "Filters (1)" })).toHaveFocus();
});
