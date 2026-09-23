import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import PropertyEstimatorPage from "./page";

test("renders the property estimator page and workspace", () => {
  render(<PropertyEstimatorPage />);

  expect(
    screen.getByRole("heading", { name: /property value estimator/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /estimate value/i }),
  ).toBeInTheDocument();
});
