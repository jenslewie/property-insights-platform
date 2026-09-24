import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ExportControls } from "./export-controls";

const filename = `property-market-analysis_${"a".repeat(8)}`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockDownload() {
  const createObjectURL = vi.fn(() => "blob:sample-export");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  const clicks: Array<{ href: string; filename: string }> = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push({ href: this.href, filename: this.download });
  });
  return { createObjectURL, revokeObjectURL, clicks };
}

test("exports the active segment as CSV and revokes the temporary object URL", async () => {
  const user = userEvent.setup();
  const downloads = mockDownload();
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("id,price\n1,200000\n", {
      headers: {
        "Content-Type": "text/csv; charset=UTF-8",
        "Content-Disposition": `attachment; filename=${filename}.csv`,
      },
    }),
  );
  render(
    <ExportControls
      filters={{ min_price: 200000 }}
      scenario={{ schoolRatingDelta: 1 }}
      matchedCount={4}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Export segment CSV" }));

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/market-analysis/export?format=csv&min_price=200000&scenario_school_rating_delta=1",
  );
  await waitFor(() => {
    expect(downloads.createObjectURL).toHaveBeenCalledTimes(1);
    expect(downloads.clicks).toEqual([
      { href: "blob:sample-export", filename: `${filename}.csv` },
    ]);
    expect(downloads.revokeObjectURL).toHaveBeenCalledWith(
      "blob:sample-export",
    );
  });
  expect(
    screen.getByText(/local table search, sorting, and pagination/i),
  ).toBeInTheDocument();
});

test("exports a PDF with the filename provided by Java", async () => {
  const user = userEvent.setup();
  const downloads = mockDownload();
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Uint8Array([37, 80, 68, 70]), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filename}.pdf`,
      },
    }),
  );
  render(<ExportControls filters={{ max_price: 500000 }} matchedCount={2} />);

  await user.click(screen.getByRole("button", { name: "Export segment PDF" }));

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/market-analysis/export?format=pdf&max_price=500000",
  );
  await waitFor(() => {
    expect(downloads.clicks).toEqual([
      { href: "blob:sample-export", filename: `${filename}.pdf` },
    ]);
    expect(downloads.revokeObjectURL).toHaveBeenCalledWith(
      "blob:sample-export",
    );
  });
});

test("a delayed PDF export reuses the same applied conditions as the earlier CSV", async () => {
  const user = userEvent.setup();
  const downloads = mockDownload();
  let resolvePdf: ((response: Response) => void) | undefined;
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation((input) => {
      if (String(input).includes("format=pdf")) {
        return new Promise((resolve) => {
          resolvePdf = resolve;
        });
      }
      return Promise.resolve(
        new Response("id,price\n", {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename=${filename}.csv`,
          },
        }),
      );
    });
  render(
    <ExportControls
      filters={{ min_bedrooms: 3 }}
      scenario={{ schoolRatingDelta: 1 }}
      matchedCount={4}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Export segment CSV" }));
  await waitFor(() => expect(downloads.clicks).toHaveLength(1));
  await user.click(screen.getByRole("button", { name: "Export segment PDF" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  resolvePdf?.(
    new Response(new Uint8Array([37, 80, 68, 70]), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filename}.pdf`,
      },
    }),
  );
  await waitFor(() => expect(downloads.clicks).toHaveLength(2));

  const csvQuery = new URLSearchParams(
    String(fetchMock.mock.calls[0][0]).split("?")[1],
  );
  const pdfQuery = new URLSearchParams(
    String(fetchMock.mock.calls[1][0]).split("?")[1],
  );
  csvQuery.delete("format");
  pdfQuery.delete("format");
  expect([...csvQuery.entries()]).toEqual([...pdfQuery.entries()]);
  expect(downloads.clicks.map((item) => item.filename)).toEqual([
    `${filename}.csv`,
    `${filename}.pdf`,
  ]);
});

test("disables both exports when the segment has no matches", () => {
  const fetchMock = vi.spyOn(globalThis, "fetch");
  render(<ExportControls filters={{}} matchedCount={0} />);

  expect(
    screen.getByRole("button", { name: "Export segment CSV" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Export segment PDF" }),
  ).toBeDisabled();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("shows a stale-data message for 404 without creating a download", async () => {
  const user = userEvent.setup();
  const downloads = mockDownload();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ error: "No rows" }, { status: 404 }),
  );
  render(<ExportControls filters={{}} matchedCount={4} />);

  await user.click(screen.getByRole("button", { name: "Export segment CSV" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This segment no longer has exportable records.",
  );
  expect(downloads.createObjectURL).not.toHaveBeenCalled();
});

test("rejects a successful response with the wrong media type", async () => {
  const user = userEvent.setup();
  const downloads = mockDownload();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ detail: "not a file" }),
  );
  render(<ExportControls filters={{}} matchedCount={4} />);

  await user.click(screen.getByRole("button", { name: "Export segment PDF" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "The export could not be downloaded.",
  );
  expect(downloads.createObjectURL).not.toHaveBeenCalled();
});

test("prevents duplicate requests while one export is loading", async () => {
  const user = userEvent.setup();
  const downloads = mockDownload();
  let resolveFetch: ((response: Response) => void) | undefined;
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
  );
  render(<ExportControls filters={{}} matchedCount={4} />);

  await user.click(screen.getByRole("button", { name: "Export segment CSV" }));
  expect(
    screen.getByRole("button", { name: "Export segment PDF" }),
  ).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  resolveFetch?.(
    new Response("id,price", {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename=${filename}.csv`,
      },
    }),
  );
  await waitFor(() => expect(downloads.revokeObjectURL).toHaveBeenCalled());
});
