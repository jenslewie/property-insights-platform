import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ScenarioDrawer } from "./scenario-drawer";

const pushState = vi.spyOn(window.history, "pushState");

beforeEach(() => {
  window.history.replaceState(null, "", "/market-analysis");
  pushState.mockClear();
});

afterEach(() => {
  pushState.mockClear();
});

test("keeps scenario inputs in a separate drawer with segment context", async () => {
  const user = userEvent.setup();
  render(
    <ScenarioDrawer
      filters={{ min_bedrooms: 3, min_bathrooms: 2 }}
      dimension="bedrooms"
      propertyCount={7}
    />,
  );

  expect(
    screen.queryByRole("dialog", { name: "What-if scenario" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "What-if scenario" }));

  expect(
    screen.getByRole("dialog", { name: "What-if scenario" }),
  ).toBeInTheDocument();
  expect(screen.getByText("7 properties")).toBeInTheDocument();
  expect(screen.getByText("Bedrooms ≥ 3")).toBeInTheDocument();
  expect(screen.getByText("Bathrooms ≥ 2")).toBeInTheDocument();
  for (const label of [
    "School rating change",
    "Square footage change (%)",
    "Bedrooms change",
    "Bathrooms change",
    "Year built change (years)",
    "Lot size change",
    "Distance to city center change",
  ]) {
    expect(screen.getByLabelText(label)).toHaveValue(null);
  }
  expect(screen.getByRole("button", { name: "Apply scenario" })).toBeDisabled();
});

test("applies all seven feature adjustments and keeps filters and chart in the URL", async () => {
  const user = userEvent.setup();
  render(
    <ScenarioDrawer
      filters={{ min_bedrooms: 3 }}
      dimension="bedrooms"
      propertyCount={7}
    />,
  );

  await user.click(screen.getByRole("button", { name: "What-if scenario" }));
  await user.type(screen.getByLabelText("School rating change"), "1");
  await user.type(screen.getByLabelText("Square footage change (%)"), "5");
  await user.type(screen.getByLabelText("Bedrooms change"), "1");
  await user.type(screen.getByLabelText("Bathrooms change"), "0.5");
  await user.type(screen.getByLabelText("Year built change (years)"), "5");
  await user.type(screen.getByLabelText("Lot size change"), "500");
  await user.type(
    screen.getByLabelText("Distance to city center change"),
    "0.5",
  );
  await user.click(screen.getByRole("button", { name: "Apply scenario" }));

  expect(pushState).toHaveBeenCalledWith(
    null,
    "",
    "/market-analysis?min_bedrooms=3&scenario_school_rating_delta=1&scenario_square_footage_percent=5&scenario_bedrooms_delta=1&scenario_bathrooms_delta=0.5&scenario_year_built_delta=5&scenario_lot_size_delta=500&scenario_distance_to_city_center_delta=0.5&chart_dimension=bedrooms",
  );
  expect(
    screen.queryByRole("dialog", { name: "What-if scenario" }),
  ).not.toBeInTheDocument();
});

test("Cancel discards the draft and reopening restores applied values", async () => {
  const user = userEvent.setup();
  render(
    <ScenarioDrawer
      filters={{ min_bedrooms: 3 }}
      scenario={{ schoolRatingDelta: 1 }}
      dimension="square_footage"
      propertyCount={7}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Edit scenario (1)" }));
  await user.clear(screen.getByLabelText("School rating change"));
  await user.type(screen.getByLabelText("School rating change"), "2");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Edit scenario (1)" }));

  expect(screen.getByLabelText("School rating change")).toHaveValue(1);
  expect(pushState).not.toHaveBeenCalled();
});

test("clears an applied scenario while preserving filters and chart", async () => {
  const user = userEvent.setup();
  const props = {
    filters: { min_bedrooms: 3 },
    dimension: "bedrooms" as const,
    propertyCount: 7,
  };
  const view = render(
    <ScenarioDrawer {...props} scenario={{ schoolRatingDelta: 1 }} />,
  );

  await user.click(screen.getByRole("button", { name: "Edit scenario (1)" }));
  await user.click(screen.getByRole("button", { name: "Clear scenario" }));

  expect(pushState).toHaveBeenCalledWith(
    null,
    "",
    "/market-analysis?min_bedrooms=3&chart_dimension=bedrooms",
  );
  view.rerender(<ScenarioDrawer {...props} />);
  expect(screen.queryByText("School rating +1")).not.toBeInTheDocument();
});

test("removes one scenario adjustment and leaves the other applied", async () => {
  const user = userEvent.setup();
  const props = {
    filters: { min_bedrooms: 3 },
    dimension: "bedrooms" as const,
    propertyCount: 7,
  };
  const view = render(
    <ScenarioDrawer
      {...props}
      scenario={{ schoolRatingDelta: 1, squareFootagePercent: 5 }}
    />,
  );

  await user.click(
    screen.getByRole("button", { name: "Remove scenario School rating +1" }),
  );

  expect(pushState).toHaveBeenCalledWith(
    null,
    "",
    "/market-analysis?min_bedrooms=3&scenario_square_footage_percent=5&chart_dimension=bedrooms",
  );
  view.rerender(
    <ScenarioDrawer {...props} scenario={{ squareFootagePercent: 5 }} />,
  );
  expect(screen.queryByText("School rating +1")).not.toBeInTheDocument();
  expect(screen.getByText("Square footage +5%")).toBeInTheDocument();
});

test("disables scenario application for an empty segment", async () => {
  const user = userEvent.setup();
  render(
    <ScenarioDrawer
      filters={{ min_bedrooms: 10 }}
      dimension="square_footage"
      propertyCount={0}
    />,
  );

  await user.click(screen.getByRole("button", { name: "What-if scenario" }));
  expect(screen.getByRole("button", { name: "Apply scenario" })).toBeDisabled();
  expect(screen.getByText(/no properties match/i)).toBeInTheDocument();
  expect(pushState).not.toHaveBeenCalled();
});

test("keeps scenario trigger focused after applying a scenario", async () => {
  const user = userEvent.setup();
  const props = {
    filters: { min_bedrooms: 3 },
    dimension: "bedrooms" as const,
    propertyCount: 7,
  };
  const view = render(<ScenarioDrawer {...props} />);
  await user.click(screen.getByRole("button", { name: "What-if scenario" }));
  await user.type(screen.getByLabelText("School rating change"), "1");
  await user.click(screen.getByRole("button", { name: "Apply scenario" }));
  view.rerender(
    <ScenarioDrawer {...props} scenario={{ schoolRatingDelta: 1 }} />,
  );

  expect(
    screen.getByRole("button", { name: "Edit scenario (1)" }),
  ).toHaveFocus();
});
