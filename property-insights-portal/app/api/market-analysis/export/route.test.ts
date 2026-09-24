import { afterEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /api/market-analysis/export", () => {
  test("streams a filtered CSV with a fixed filename and verified type", async () => {
    vi.stubEnv("MARKET_ANALYSIS_API_URL", "http://market:9002/");
    const bytes = new TextEncoder().encode("id,price\n1,200000\n");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(bytes, {
        headers: {
          "Content-Type": "text/csv; charset=UTF-8",
          "Content-Disposition": "attachment; filename=untrusted.csv",
        },
      }),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/market-analysis/export?type=data&format=csv&min_price=200000",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/csv; charset=UTF-8",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      "attachment; filename=properties.csv",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([
      ...bytes,
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://market:9002/api/v1/properties/export?type=data&format=csv&min_price=200000",
      { cache: "no-store" },
    );
  });

  test("streams a PDF report with the fixed report filename", async () => {
    const bytes = new Uint8Array([37, 80, 68, 70]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(bytes, { headers: { "Content-Type": "application/pdf" } }),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/market-analysis/export?type=report&format=pdf",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      "attachment; filename=market-report.pdf",
    );
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([
      ...bytes,
    ]);
  });

  test.each([
    "type=data&format=pdf",
    "type=data&format=csv&unknown_filter=1",
    "type=data&format=csv&min_price=1&min_price=2",
    "type=data&format=csv&chart_dimension=bedrooms",
    "type=data&format=csv&type=report",
    "type=data&format=csv&format=csv",
  ])("returns 400 without fetching for invalid query %s", async (query) => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await GET(
      new Request(`http://localhost/api/market-analysis/export?${query}`),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("returns JSON for stale no-match exports without attachment headers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { detail: "No properties match the selected filters." },
        { status: 404 },
      ),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/market-analysis/export?type=data&format=csv",
      ),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(await response.json()).toEqual({
      error: "No properties match the selected filters.",
    });
  });

  test("returns 503 when the market-analysis service is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("refused"));

    const response = await GET(
      new Request(
        "http://localhost/api/market-analysis/export?type=data&format=csv",
      ),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Market analysis service is unavailable.",
    });
  });

  test("returns 502 if a successful upstream response has the wrong media type", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("do not download", {
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/market-analysis/export?type=data&format=csv",
      ),
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(await response.json()).toEqual({
      error: "Market analysis service returned an invalid export.",
    });
  });
});
