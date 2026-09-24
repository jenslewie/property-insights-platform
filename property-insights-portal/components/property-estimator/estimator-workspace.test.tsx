import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EstimatorWorkspace } from "./estimator-workspace";

const firstEstimate = {
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

const thirdEstimate = {
  property: {
    square_footage: 1800,
    bedrooms: 3,
    bathrooms: 2,
    year_built: 2012,
    lot_size: 7100,
    distance_to_city_center: 5.2,
    school_rating: 8.1,
  },
  predicted_price: 301125,
};

const fourthEstimate = {
  property: {
    square_footage: 2450,
    bedrooms: 4,
    bathrooms: 3,
    year_built: 2019,
    lot_size: 10200,
    distance_to_city_center: 8.3,
    school_rating: 9.2,
  },
  predicted_price: 415600,
};

const scrollIntoView = vi.fn();

async function submitSingle(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /estimate value/i }));
  await screen.findByRole("table", { name: "Prediction results" });
}

async function removeEstimate(
  user: ReturnType<typeof userEvent.setup>,
  number: number,
) {
  const row = within(
    screen.getByRole("table", { name: "Estimate history" }),
  ).getByRole("row", { name: new RegExp(`Estimate #${number}`) });
  await user.click(within(row).getByText("⋯"));
  await user.click(
    screen.getByRole("button", { name: `Remove Estimate #${number}` }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

beforeEach(() => {
  scrollIntoView.mockClear();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
});

test("starts without prediction or comparison, then shows a single chart and table", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(firstEstimate));

  const user = userEvent.setup();
  render(<EstimatorWorkspace />);

  expect(
    screen.queryByRole("region", { name: "Prediction results" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Property comparison" }),
  ).not.toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { name: "Estimate history" }),
  ).toBeInTheDocument();

  await submitSingle(user);

  expect(
    screen.getByRole("region", { name: "Prediction results" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Latest estimate · Estimate #1")).toBeInTheDocument();
  expect(
    screen.getByRole("img", {
      name: "Bar chart showing predicted property prices. Estimate #1",
    }),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("table", { name: "Prediction results" })).getByRole(
      "row",
      { name: /Estimate #1/ },
    ),
  ).toBeInTheDocument();
  expect(screen.getAllByText("Estimate #1")).toHaveLength(2);
  expect(
    screen.getByRole("button", { name: "Compare selected" }),
  ).toBeDisabled();
});

test("keeps a one-property batch as a batch and does not preselect it", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ count: 1, estimates: [firstEstimate] }),
  );

  const user = userEvent.setup();
  render(<EstimatorWorkspace />);

  await user.click(screen.getByRole("radio", { name: "Batch" }));
  await user.click(screen.getByRole("button", { name: /estimate 1 propert/i }));

  expect(
    await screen.findByText("Latest batch · 1 estimate"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("img", {
      name: "Bar chart showing predicted property prices. Estimate #1",
    }),
  ).toBeInTheDocument();
  expect(
    within(
      screen.getByRole("table", { name: "Prediction results" }),
    ).getAllByRole("row"),
  ).toHaveLength(2);
  expect(
    screen.getByRole("checkbox", {
      name: "Select Estimate #1 for comparison",
    }),
  ).not.toBeChecked();
});

test("a failed later request preserves the latest result and history", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json(firstEstimate))
    .mockRejectedValueOnce(new Error("offline"));

  const user = userEvent.setup();
  render(<EstimatorWorkspace />);

  await submitSingle(user);
  await user.click(screen.getByRole("button", { name: /estimate value/i }));
  expect(
    await screen.findByText(
      "The estimate service is unavailable. Please try again.",
    ),
  ).toBeInTheDocument();

  expect(screen.getByText("Latest estimate · Estimate #1")).toBeInTheDocument();
  expect(
    within(
      screen.getByRole("table", { name: "Estimate history" }),
    ).getAllByRole("row"),
  ).toHaveLength(2);
});

test("compares only confirmed history, keeps predictions independent, and removes stale comparisons", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(Response.json(firstEstimate))
    .mockResolvedValueOnce(Response.json(secondEstimate))
    .mockResolvedValueOnce(Response.json(thirdEstimate))
    .mockResolvedValueOnce(Response.json(fourthEstimate));

  const user = userEvent.setup();
  render(<EstimatorWorkspace />);

  await submitSingle(user);
  await submitSingle(user);

  await user.click(
    screen.getByRole("checkbox", {
      name: "Select Estimate #1 for comparison",
    }),
  );
  await user.click(
    screen.getByRole("checkbox", {
      name: "Select Estimate #2 for comparison",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Compare selected" }));

  const comparison = await screen.findByRole("region", {
    name: "Property comparison",
  });
  expect(
    within(comparison).getByRole("heading", { name: "Price comparison" }),
  ).toBeInTheDocument();
  expect(
    within(comparison).getByRole("img", {
      name: "Bar chart comparing predicted property prices. Estimate #1, Estimate #2",
    }),
  ).toBeInTheDocument();
  const firstMatrix = within(comparison).getByRole("table", {
    name: "Side-by-side property comparison",
  });
  expect(within(firstMatrix).getAllByRole("row")).toHaveLength(9);
  expect(
    within(firstMatrix).getByRole("columnheader", { name: "Estimate #1" }),
  ).toBeInTheDocument();
  expect(
    within(firstMatrix).getByRole("columnheader", { name: "Estimate #2" }),
  ).toBeInTheDocument();
  expect(scrollIntoView).toHaveBeenCalledWith({
    behavior: "smooth",
    block: "start",
  });

  await submitSingle(user);
  expect(screen.getByText("Latest estimate · Estimate #3")).toBeInTheDocument();
  expect(
    screen.getByRole("img", {
      name: "Bar chart showing predicted property prices. Estimate #3",
    }),
  ).toBeInTheDocument();
  expect(
    within(comparison).getByRole("img", {
      name: "Bar chart comparing predicted property prices. Estimate #1, Estimate #2",
    }),
  ).toBeInTheDocument();

  await user.click(
    screen.getByRole("checkbox", {
      name: "Select Estimate #3 for comparison",
    }),
  );
  await user.click(
    screen.getByRole("checkbox", {
      name: "Select Estimate #1 for comparison",
    }),
  );
  expect(
    within(comparison).getByRole("columnheader", { name: "Estimate #1" }),
  ).toBeInTheDocument();
  expect(
    within(comparison).getByRole("columnheader", { name: "Estimate #2" }),
  ).toBeInTheDocument();

  await removeEstimate(user, 1);
  expect(
    screen.queryByRole("region", { name: "Property comparison" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Latest estimate · Estimate #3")).toBeInTheDocument();
  const remainingHistory = screen.getByRole("table", {
    name: "Estimate history",
  });
  expect(within(remainingHistory).getByText("Estimate #2")).toBeInTheDocument();
  expect(within(remainingHistory).getByText("Estimate #3")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Compare selected" }));
  const nextComparison = await screen.findByRole("region", {
    name: "Property comparison",
  });
  expect(
    within(nextComparison).getByRole("img", {
      name: "Bar chart comparing predicted property prices. Estimate #2, Estimate #3",
    }),
  ).toBeInTheDocument();

  await removeEstimate(user, 2);
  expect(
    screen.queryByRole("region", { name: "Property comparison" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Latest estimate · Estimate #3")).toBeInTheDocument();

  await submitSingle(user);
  expect(screen.getByText("Latest estimate · Estimate #4")).toBeInTheDocument();
  expect(
    screen.getByRole("checkbox", {
      name: "Select Estimate #4 for comparison",
    }),
  ).not.toBeChecked();

  expect(
    screen.getByRole("checkbox", {
      name: "Select Estimate #3 for comparison",
    }),
  ).toBeChecked();
  await user.click(
    screen.getByRole("checkbox", {
      name: "Select Estimate #4 for comparison",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Compare selected" }));
  expect(
    await screen.findByRole("region", { name: "Property comparison" }),
  ).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Clear history" }));
  await user.click(
    screen.getByRole("button", { name: "Confirm clear history" }),
  );

  expect(
    screen.queryByRole("region", { name: "Property comparison" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Latest estimate · Estimate #4")).toBeInTheDocument();
  expect(screen.getByText("No saved estimates yet.")).toBeInTheDocument();
});
