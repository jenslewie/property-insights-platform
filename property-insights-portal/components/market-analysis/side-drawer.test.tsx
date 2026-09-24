import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { SideDrawer } from "./side-drawer";

test("shows the drawer as an accessible modal dialog", () => {
  render(
    <SideDrawer open onClose={vi.fn()} title="Filters">
      <label>
        Minimum bedrooms
        <input autoFocus />
      </label>
    </SideDrawer>,
  );

  expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
});

test("sends Escape cancellation to its owner", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <>
      <button>Open</button>
      <SideDrawer open onClose={onClose} title="Filters">
        <button>Apply</button>
      </SideDrawer>
    </>,
  );

  await user.click(screen.getByRole("button", { name: "Open" }));
  fireEvent(
    screen.getByRole("dialog"),
    new Event("cancel", { cancelable: true }),
  );

  expect(onClose).toHaveBeenCalledOnce();
});
