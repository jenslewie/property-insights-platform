import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { EstimatorWorkspace } from "./estimator-workspace";

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

afterEach(() => vi.restoreAllMocks());

test("shows the latest estimate after a successful form submission", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(estimate));

  const user = userEvent.setup();
  render(<EstimatorWorkspace />);

  expect(
    screen.getByText(/submit the form to see an estimate/i),
  ).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /estimate value/i }));

  await waitFor(() => {
    expect(
      screen.getByRole("heading", { name: /latest estimate/i }),
    ).toBeInTheDocument();
  });

  expect(screen.getAllByText("250,879.73")).toHaveLength(2);
  expect(
    screen.getByRole("heading", { name: /estimate history/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("img", {
      name: /bar chart comparing predicted property prices/i,
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("checkbox", { name: /compare estimate/i }),
  ).toBeInTheDocument();
});

test("adds a successful batch to history and comparison", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      count: 2,
      estimates: [estimate, secondEstimate],
    }),
  );

  const user = userEvent.setup();
  render(<EstimatorWorkspace />);

  await user.click(screen.getByRole("radio", { name: /batch/i }));
  await user.click(screen.getByRole("button", { name: /add property/i }));
  await user.click(
    screen.getByRole("button", { name: /estimate 2 properties/i }),
  );

  expect(
    await screen.findByRole("heading", { name: /latest batch/i }),
  ).toBeInTheDocument();
  expect(screen.getByText(/2 estimates completed/i)).toBeInTheDocument();
  expect(
    screen.getByRole("table", { name: /selected property comparison/i }),
  ).toBeInTheDocument();
  expect(
    screen.getAllByRole("checkbox", { name: /compare estimate/i }),
  ).toHaveLength(2);
});

test("keeps a one-property batch in batch mode", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      count: 1,
      estimates: [estimate],
    }),
  );

  const user = userEvent.setup();
  render(<EstimatorWorkspace />);

  await user.click(screen.getByRole("radio", { name: /batch/i }));
  await user.click(
    screen.getByRole("button", { name: /estimate 1 properties/i }),
  );

  expect(
    await screen.findByRole("heading", { name: /latest batch/i }),
  ).toBeInTheDocument();
  expect(screen.getByText(/1 estimate completed/i)).toBeInTheDocument();
  expect(
    screen.getByRole("checkbox", { name: /compare estimate/i }),
  ).toBeChecked();
});
