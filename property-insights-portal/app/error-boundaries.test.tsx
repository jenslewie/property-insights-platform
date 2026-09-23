import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import RootError from "./error";
import RootLoading from "./loading";
import EstimatorError from "./property-estimator/error";
import EstimatorLoading from "./property-estimator/loading";

const error = new Error("test error");

afterEach(() => vi.restoreAllMocks());

test("renders root and estimator loading states", () => {
  render(
    <>
      <RootLoading />
      <EstimatorLoading />
    </>,
  );

  expect(screen.getAllByRole("status")).toHaveLength(2);
  expect(screen.getByText("Loading Property Insights…")).toBeInTheDocument();
  expect(
    screen.getByText("Loading the property estimator…"),
  ).toBeInTheDocument();
});

test("root error logs the error and retries", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const reset = vi.fn();
  const user = userEvent.setup();

  render(<RootError error={error} reset={reset} />);

  expect(screen.getByRole("alert")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /try again/i }));

  expect(reset).toHaveBeenCalledTimes(1);
  expect(consoleError).toHaveBeenCalledWith(error);
});

test("estimator error offers recovery", async () => {
  const reset = vi.fn();
  const user = userEvent.setup();

  render(<EstimatorError error={error} reset={reset} />);

  expect(
    screen.getByRole("heading", {
      name: /estimator page could not be displayed/i,
    }),
  ).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /try again/i }));

  expect(reset).toHaveBeenCalledTimes(1);
});
