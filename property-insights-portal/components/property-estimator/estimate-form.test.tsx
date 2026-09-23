import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { EstimateForm } from "./estimate-form";

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

afterEach(() => vi.restoreAllMocks());

test("blocks an invalid property before fetch", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch");
  const user = userEvent.setup();

  render(<EstimateForm onSuccessAction={vi.fn()} />);

  await user.clear(screen.getByLabelText(/square footage/i));
  await user.type(screen.getByLabelText(/square footage/i), "0");
  await user.click(screen.getByRole("button", { name: /estimate value/i }));

  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.getByText(/too small/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/square footage/i)).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByLabelText(/square footage/i)).toHaveAttribute(
    "aria-describedby",
    "square_footage-0-error",
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

test("maps a server validation error to the single property field", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json(
      {
        error: "Request validation failed.",
        fieldErrors: [
          {
            loc: ["body", "PropertyFeatures", "square_footage"],
            msg: "Input should be greater than 0",
            type: "greater_than",
          },
        ],
      },
      { status: 422 },
    ),
  );

  const user = userEvent.setup();
  render(<EstimateForm onSuccessAction={vi.fn()} />);

  await user.click(screen.getByRole("button", { name: /estimate value/i }));

  expect(
    await screen.findByText("Input should be greater than 0"),
  ).toBeInTheDocument();
  expect(screen.getByLabelText(/square footage/i)).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(
    screen.getByText("Please correct the highlighted fields."),
  ).toBeInTheDocument();
});

test("maps a server validation error to the indexed batch property field", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json(
      {
        error: "Request validation failed.",
        fieldErrors: [
          {
            loc: ["body", "PropertyFeatures"],
            msg: "Input should be a valid dictionary or object",
            type: "model_attributes_type",
          },
          {
            loc: ["body", "list[PropertyFeatures]", 1, "bedrooms"],
            msg: "Input should be less than or equal to 10",
            type: "less_than_equal",
          },
        ],
      },
      { status: 422 },
    ),
  );

  const user = userEvent.setup();
  render(<EstimateForm onSuccessAction={vi.fn()} />);

  await user.click(screen.getByRole("radio", { name: /batch/i }));
  await user.click(screen.getByRole("button", { name: /add property/i }));
  await user.click(
    screen.getByRole("button", { name: /estimate 2 properties/i }),
  );

  const secondBedrooms = document.getElementById("bedrooms-1");
  expect(secondBedrooms).toHaveAttribute("aria-invalid", "true");
  expect(secondBedrooms).toHaveAttribute(
    "aria-describedby",
    "bedrooms-1-error",
  );
  expect(
    await screen.findByText("Input should be less than or equal to 10"),
  ).toBeInTheDocument();
});

test("returns a valid estimate to its parent", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(estimate));

  const onSuccessAction = vi.fn();
  const user = userEvent.setup();

  render(<EstimateForm onSuccessAction={onSuccessAction} />);

  await user.click(screen.getByRole("button", { name: /estimate value/i }));

  await waitFor(() => {
    expect(onSuccessAction).toHaveBeenCalledWith(estimate);
  });
});

test("submits and returns a batch of properties", async () => {
  const batchEstimate = {
    count: 2,
    estimates: [estimate, estimate],
  };
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json(batchEstimate));
  const onSuccessAction = vi.fn();
  const user = userEvent.setup();

  render(<EstimateForm onSuccessAction={onSuccessAction} />);

  await user.click(screen.getByRole("radio", { name: /batch/i }));
  await user.click(screen.getByRole("button", { name: /add property/i }));
  await user.click(
    screen.getByRole("button", { name: /estimate 2 properties/i }),
  );

  await waitFor(() => {
    expect(onSuccessAction).toHaveBeenCalledWith(batchEstimate);
  });

  const requestInit = fetchMock.mock.calls[0]?.[1];
  expect(JSON.parse(String(requestInit?.body))).toEqual([
    estimate.property,
    estimate.property,
  ]);
});

test("renders each batch property as one row in the property editor", async () => {
  const user = userEvent.setup();

  render(<EstimateForm onSuccessAction={vi.fn()} />);

  await user.click(screen.getByRole("radio", { name: /batch/i }));
  await user.click(screen.getByRole("button", { name: /add property/i }));

  const editor = screen.getByRole("table", { name: /property inputs/i });
  const rows = within(editor).getAllByRole("row");

  expect(rows).toHaveLength(3);
  expect(within(rows[1]).getAllByRole("spinbutton")).toHaveLength(7);
  expect(within(rows[2]).getAllByRole("spinbutton")).toHaveLength(7);
  expect(
    within(rows[2]).getByRole("button", { name: /remove property 2/i }),
  ).toBeInTheDocument();
});

test("uses explicit property field names in the editor columns", () => {
  render(<EstimateForm onSuccessAction={vi.fn()} />);

  const editor = screen.getByRole("table", { name: /property inputs/i });

  expect(
    within(editor)
      .getAllByRole("columnheader")
      .map((header) => header.textContent),
  ).toEqual([
    "Property",
    "Square footage",
    "Bedrooms",
    "Bathrooms",
    "Year built",
    "Lot size",
    "Distance to city center",
    "School rating",
    "Actions",
  ]);
});

test("preserves batch semantics when the batch contains one property", async () => {
  const batchEstimate = {
    count: 1,
    estimates: [estimate],
  };
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json(batchEstimate));
  const onSuccessAction = vi.fn();
  const user = userEvent.setup();

  render(<EstimateForm onSuccessAction={onSuccessAction} />);

  await user.click(screen.getByRole("radio", { name: /batch/i }));
  await user.click(
    screen.getByRole("button", { name: /estimate 1 properties/i }),
  );

  await waitFor(() => {
    expect(onSuccessAction).toHaveBeenCalledWith(batchEstimate);
  });

  const requestInit = fetchMock.mock.calls[0]?.[1];
  expect(JSON.parse(String(requestInit?.body))).toEqual([estimate.property]);
});

test("removes a property from a batch", async () => {
  const user = userEvent.setup();

  render(<EstimateForm onSuccessAction={vi.fn()} />);

  await user.click(screen.getByRole("radio", { name: /batch/i }));
  await user.click(screen.getByRole("button", { name: /add property/i }));

  expect(screen.getByRole("row", { name: /property 2/i })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /remove property 2/i }));

  expect(
    screen.queryByRole("row", { name: /property 2/i }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /estimate 1 properties/i }),
  ).toBeInTheDocument();
});

test("limits a batch to twenty properties", async () => {
  const user = userEvent.setup();

  render(<EstimateForm onSuccessAction={vi.fn()} />);

  await user.click(screen.getByRole("radio", { name: /batch/i }));
  const addButton = screen.getByRole("button", { name: /add property/i });

  for (let index = 1; index < 20; index += 1) {
    await user.click(addButton);
  }

  expect(addButton).toBeDisabled();
  expect(screen.getByRole("row", { name: /property 20/i })).toBeInTheDocument();
});

test("disables submission while a request is pending", async () => {
  let resolveResponse!: (response: Response) => void;

  const pending = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });

  const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValue(pending);
  const user = userEvent.setup();

  render(<EstimateForm onSuccessAction={vi.fn()} />);

  const button = screen.getByRole("button", { name: /estimate value/i });

  await user.click(button);
  expect(button).toBeDisabled();

  await user.click(button);
  expect(fetchMock).toHaveBeenCalledTimes(1);

  resolveResponse(Response.json(estimate));
  await waitFor(() => expect(button).not.toBeDisabled());
});
