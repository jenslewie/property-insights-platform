import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { PriceImpact } from "./price-impact";
import type { PropertyRecord } from "@/lib/market-analysis/schemas";

const firstProperty: PropertyRecord = {
  id: 1,
  square_footage: 1550,
  bedrooms: 3,
  bathrooms: 2,
  year_built: 1997,
  lot_size: 6800,
  distance_to_city_center: 4.1,
  school_rating: 7.6,
  price: 410000,
};

const secondProperty: PropertyRecord = {
  ...firstProperty,
  id: 2,
  square_footage: 2200,
  bedrooms: 4,
  bathrooms: 2.5,
  year_built: 2008,
  lot_size: 9600,
  distance_to_city_center: 7,
  school_rating: 8.8,
  price: 520000,
};

const firstResult = {
  baseline: {
    square_footage: 1550,
    bedrooms: 3,
    bathrooms: 2,
    year_built: 1997,
    lot_size: 6800,
    distance_to_city_center: 4.1,
    school_rating: 7.6,
  },
  changes: { square_footage: { from: 1550, to: 1800 } },
  baseline_predicted_price: 0,
  scenario_predicted_price: 12000,
  absolute_change: 12000,
  percentage_change: null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

test("prefills seven fields and disables a comparison with no effective changes", () => {
  render(<PriceImpact property={firstProperty} />);

  expect(screen.getByLabelText("Square footage")).toHaveValue(1550);
  expect(screen.getByLabelText("Bedrooms")).toHaveValue(3);
  expect(screen.getByLabelText("Bathrooms")).toHaveValue(2);
  expect(screen.getByLabelText("Year built")).toHaveValue(1997);
  expect(screen.getByLabelText("Lot size")).toHaveValue(6800);
  expect(screen.getByLabelText("Distance to city center")).toHaveValue(4.1);
  expect(screen.getByLabelText("School rating")).toHaveValue(7.6);
  expect(
    screen.getByRole("button", { name: "Compare price impact" }),
  ).toBeDisabled();
  expect(
    screen.getByText("Change at least one feature to compare."),
  ).toBeInTheDocument();
});

test("posts only changed features and renders model predictions and a null percentage marker", async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json(firstResult));
  render(<PriceImpact property={firstProperty} />);

  await user.clear(screen.getByLabelText("Square footage"));
  await user.type(screen.getByLabelText("Square footage"), "1800");
  await user.click(
    screen.getByRole("button", { name: "Compare price impact" }),
  );

  const baseline = {
    square_footage: 1550,
    bedrooms: 3,
    bathrooms: 2,
    year_built: 1997,
    lot_size: 6800,
    distance_to_city_center: 4.1,
    school_rating: 7.6,
  };
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/market-analysis/price-impact",
    expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ baseline, changes: { square_footage: 1800 } }),
    }),
  );
  const sentBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
  expect(sentBody.baseline).not.toHaveProperty("id");
  expect(sentBody.baseline).not.toHaveProperty("price");
  expect(sentBody).not.toHaveProperty("scenario");

  expect(await screen.findByText("12,000")).toBeInTheDocument();
  expect(
    screen.getByText("Model predicted baseline price"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Model predicted scenario price"),
  ).toBeInTheDocument();
  expect(screen.getByText("+12,000")).toBeInTheDocument();
  expect(screen.getByText("Unavailable")).toBeInTheDocument();
});

test("keeps invalid year values local and does not request a prediction", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.spyOn(globalThis, "fetch");
  render(<PriceImpact property={firstProperty} />);

  await user.clear(screen.getByLabelText("Year built"));
  await user.type(screen.getByLabelText("Year built"), "1899");
  await user.click(
    screen.getByRole("button", { name: "Compare price impact" }),
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(/1900/);
  expect(screen.getByLabelText("Year built")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

test("treats a numerically equivalent value as unchanged", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.spyOn(globalThis, "fetch");
  render(<PriceImpact property={firstProperty} />);

  await user.clear(screen.getByLabelText("Bathrooms"));
  await user.type(screen.getByLabelText("Bathrooms"), "2.0");

  expect(
    screen.getByRole("button", { name: "Compare price impact" }),
  ).toBeDisabled();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("clears a previous result when the selected property changes", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(firstResult));
  const { rerender } = render(<PriceImpact property={firstProperty} />);

  await user.clear(screen.getByLabelText("Square footage"));
  await user.type(screen.getByLabelText("Square footage"), "1800");
  await user.click(
    screen.getByRole("button", { name: "Compare price impact" }),
  );
  expect(
    await screen.findByText("Model predicted baseline price"),
  ).toBeInTheDocument();

  rerender(<PriceImpact property={secondProperty} />);

  await waitFor(() => {
    expect(
      screen.queryByText("Model predicted baseline price"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Square footage")).toHaveValue(2200);
  });
});

test("clears old results on property change and ignores a late prior response", async () => {
  const user = userEvent.setup();
  const resolvers: Array<(response: Response) => void> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(
    () => new Promise((resolve) => resolvers.push(resolve)),
  );
  const { rerender } = render(<PriceImpact property={firstProperty} />);

  await user.clear(screen.getByLabelText("Square footage"));
  await user.type(screen.getByLabelText("Square footage"), "1800");
  await user.click(
    screen.getByRole("button", { name: "Compare price impact" }),
  );
  expect(resolvers).toHaveLength(1);

  rerender(<PriceImpact property={secondProperty} />);
  expect(
    screen.queryByText("Model predicted baseline price"),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Square footage")).toHaveValue(2200);
  await user.clear(screen.getByLabelText("Bedrooms"));
  await user.type(screen.getByLabelText("Bedrooms"), "5");
  await user.click(
    screen.getByRole("button", { name: "Compare price impact" }),
  );
  expect(resolvers).toHaveLength(2);

  const secondResult = {
    ...firstResult,
    baseline: {
      ...firstResult.baseline,
      square_footage: 2200,
      bedrooms: 4,
      bathrooms: 2.5,
      year_built: 2008,
      lot_size: 9600,
      distance_to_city_center: 7,
      school_rating: 8.8,
    },
    changes: { bedrooms: { from: 4, to: 5 } },
    baseline_predicted_price: 520000,
    scenario_predicted_price: 535000,
    absolute_change: 15000,
    percentage_change: 2.88,
  };
  await act(async () => {
    resolvers[1](Response.json(secondResult));
  });
  expect(await screen.findByText("520,000")).toBeInTheDocument();

  await act(async () => {
    resolvers[0](Response.json(firstResult));
  });
  await waitFor(() => {
    expect(screen.getByText("520,000")).toBeInTheDocument();
    expect(
      screen.queryByText("Model predicted baseline price"),
    ).toBeInTheDocument();
  });
  expect(screen.queryByText("0", { selector: "dd" })).not.toBeInTheDocument();
});
