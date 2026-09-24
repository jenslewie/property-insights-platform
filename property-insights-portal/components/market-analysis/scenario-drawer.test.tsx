import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { PropertyRecord } from "@/lib/market-analysis/schemas";
import { ScenarioDrawer } from "./scenario-drawer";

const pushState = vi.spyOn(window.history, "pushState");

beforeEach(() => {
  window.history.replaceState(null, "", "/market-analysis");
  pushState.mockClear();
});

afterEach(() => {
  pushState.mockClear();
});

function property(overrides: Partial<PropertyRecord> = {}): PropertyRecord {
  return {
    id: 1,
    square_footage: 1500,
    bedrooms: 3,
    bathrooms: 2,
    year_built: 1997,
    lot_size: 6800,
    distance_to_city_center: 4.1,
    school_rating: 7,
    price: 200000,
    ...overrides,
  };
}

test("keeps scenario inputs in a separate drawer with segment context", async () => {
  const user = userEvent.setup();
  render(
    <ScenarioDrawer
      filters={{ min_bedrooms: 3, min_bathrooms: 2 }}
      dimension="bedrooms"
      propertyCount={7}
      properties={[property()]}
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
      properties={[property()]}
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
      properties={[property()]}
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
    properties: [property()],
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
    properties: [property()],
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
      properties={[]}
    />,
  );

  await user.click(screen.getByRole("button", { name: "What-if scenario" }));
  expect(screen.getByRole("button", { name: "Apply scenario" })).toBeDisabled();
  expect(screen.getByText(/no properties match/i)).toBeInTheDocument();
  expect(pushState).not.toHaveBeenCalled();
});

test("shows how many properties school rating -19 would make invalid", async () => {
  const user = userEvent.setup();
  render(
    <ScenarioDrawer
      filters={{}}
      dimension="square_footage"
      propertyCount={2}
      properties={[property(), property({ id: 2, school_rating: 8 })]}
    />,
  );

  await user.click(screen.getByRole("button", { name: "What-if scenario" }));
  const input = screen.getByLabelText("School rating change");
  await user.type(input, "-19");

  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "This adjustment would put 2 properties outside the allowed school rating range.",
  );
  expect(screen.getByRole("button", { name: "Apply scenario" })).toBeDisabled();
  expect(pushState).not.toHaveBeenCalled();
});

test.each([
  ["Square footage change (%)", "-100", { square_footage: 1500 }],
  ["Bedrooms change", "-3", { bedrooms: 3 }],
  ["Bathrooms change", "-2", { bathrooms: 2 }],
  ["Year built change (years)", "-100", { year_built: 1997 }],
  ["Lot size change", "-6800", { lot_size: 6800 }],
  ["Distance to city center change", "-5", { distance_to_city_center: 4.1 }],
  ["School rating change", "-8", { school_rating: 7 }],
  ["Square footage change (%)", "600", { square_footage: 1500 }],
  ["Bedrooms change", "8", { bedrooms: 3 }],
  ["Bathrooms change", "9", { bathrooms: 2 }],
  [
    "Year built change (years)",
    String(new Date().getUTCFullYear() + 6 - 1997),
    { year_built: 1997 },
  ],
  ["Lot size change", "94000", { lot_size: 6800 }],
  ["Distance to city center change", "96", { distance_to_city_center: 4.1 }],
  ["School rating change", "14", { school_rating: 7 }],
] as const)(
  "blocks an adjustment that makes %s invalid",
  async (label, value, feature) => {
    const user = userEvent.setup();
    render(
      <ScenarioDrawer
        filters={{}}
        dimension="square_footage"
        propertyCount={1}
        properties={[property(feature)]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "What-if scenario" }));
    const input = screen.getByLabelText(label);
    await user.type(input, value);

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("outside the allowed");
    expect(
      screen.getByRole("button", { name: "Apply scenario" }),
    ).toBeDisabled();
  },
);

test.each(["-7", "13"])(
  "allows a school rating adjustment that reaches an inclusive boundary (%s)",
  async (value) => {
    const user = userEvent.setup();
    render(
      <ScenarioDrawer
        filters={{}}
        dimension="square_footage"
        propertyCount={1}
        properties={[property()]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "What-if scenario" }));
    await user.type(screen.getByLabelText("School rating change"), value);

    expect(
      screen.getByRole("button", { name: "Apply scenario" }),
    ).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  },
);

test("keeps scenario trigger focused after applying a scenario", async () => {
  const user = userEvent.setup();
  const props = {
    filters: { min_bedrooms: 3 },
    dimension: "bedrooms" as const,
    propertyCount: 7,
    properties: [property()],
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
