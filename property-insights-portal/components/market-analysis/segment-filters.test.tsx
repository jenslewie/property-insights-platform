import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { SegmentFiltersForm } from "./segment-filters";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockReset();
});

test("applies active bounds and feature dimension to a shareable URL", async () => {
  const user = userEvent.setup();
  render(<SegmentFiltersForm filters={{}} dimension="square_footage" />);

  await user.type(screen.getByLabelText("Minimum price"), "200000");
  await user.type(screen.getByLabelText("Maximum price"), "300000");
  await user.selectOptions(
    screen.getByLabelText("Feature distribution"),
    "bedrooms",
  );
  await user.click(screen.getByRole("button", { name: "Apply filters" }));

  expect(push).toHaveBeenCalledWith(
    "/market-analysis?min_price=200000&max_price=300000&chart_dimension=bedrooms",
  );
});

test("shows an inverted range error without navigating", async () => {
  const user = userEvent.setup();
  render(<SegmentFiltersForm filters={{}} dimension="square_footage" />);

  await user.type(screen.getByLabelText("Minimum price"), "300000");
  await user.type(screen.getByLabelText("Maximum price"), "200000");
  await user.click(screen.getByRole("button", { name: "Apply filters" }));

  expect(screen.getByRole("alert")).toHaveTextContent(/minimum.*maximum/i);
  expect(push).not.toHaveBeenCalled();
});

test("reset clears bounds but retains the selected chart dimension", async () => {
  const user = userEvent.setup();
  render(
    <SegmentFiltersForm filters={{ min_price: 200000 }} dimension="bedrooms" />,
  );

  await user.click(screen.getByRole("button", { name: "Reset filters" }));

  expect(push).toHaveBeenCalledWith(
    "/market-analysis?chart_dimension=bedrooms",
  );
  expect(screen.getByLabelText("Minimum price")).toHaveValue(null);
});

test("applies changed filters together with the applied scenario", async () => {
  const user = userEvent.setup();
  render(
    <SegmentFiltersForm
      filters={{ min_bedrooms: 3 }}
      scenario={{ schoolRatingDelta: 1 }}
      dimension="bedrooms"
    />,
  );

  await user.clear(screen.getByLabelText("Minimum bedrooms"));
  await user.type(screen.getByLabelText("Minimum bedrooms"), "4");
  await user.click(screen.getByRole("button", { name: "Apply filters" }));

  expect(push).toHaveBeenCalledWith(
    "/market-analysis?min_bedrooms=4&scenario_school_rating_delta=1&chart_dimension=bedrooms",
  );
});

test("applies a chart-only change without changing market conditions", async () => {
  const user = userEvent.setup();
  render(
    <SegmentFiltersForm
      filters={{ min_bedrooms: 3 }}
      scenario={{ squareFootagePercent: 5 }}
      dimension="square_footage"
    />,
  );

  await user.selectOptions(
    screen.getByLabelText("Feature distribution"),
    "bedrooms",
  );
  await user.click(screen.getByRole("button", { name: "Apply filters" }));

  expect(push).toHaveBeenCalledWith(
    "/market-analysis?min_bedrooms=3&scenario_square_footage_percent=5&chart_dimension=bedrooms",
  );
});

test("restores filter and scenario drafts when browser history changes the URL", async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <SegmentFiltersForm
      filters={{ min_bedrooms: 3 }}
      scenario={{ schoolRatingDelta: 1 }}
      dimension="bedrooms"
    />,
  );

  rerender(
    <SegmentFiltersForm
      filters={{ min_bedrooms: 4 }}
      scenario={{ squareFootagePercent: 5 }}
      dimension="square_footage"
    />,
  );
  expect(screen.getByLabelText("Minimum bedrooms")).toHaveValue(4);
  expect(screen.getByLabelText("Feature distribution")).toHaveValue(
    "square_footage",
  );

  await user.clear(screen.getByLabelText("Minimum bedrooms"));
  await user.type(screen.getByLabelText("Minimum bedrooms"), "5");
  await user.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(push).toHaveBeenCalledWith(
    "/market-analysis?min_bedrooms=5&scenario_square_footage_percent=5&chart_dimension=square_footage",
  );
});
