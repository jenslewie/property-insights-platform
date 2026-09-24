import { afterEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const analysisKey = "a".repeat(8);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /api/market-analysis/export", () => {
  test("streams CSV with validated conditions and preserves the Java filename", async () => {
    vi.stubEnv("MARKET_ANALYSIS_API_URL", "http://market:9002/");
    const bytes = new TextEncoder().encode("id,price\n1,200000\n");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(bytes, {
        headers: {
          "Content-Type": "text/csv; charset=UTF-8",
          "Content-Disposition": `attachment; filename=property-market-analysis_${analysisKey}.csv`,
        },
      }),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/market-analysis/export?format=csv&min_price=200000&scenario_school_rating_delta=1.00",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/csv; charset=UTF-8",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename=property-market-analysis_${analysisKey}.csv`,
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([
      ...bytes,
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://market:9002/api/v1/market/export?format=csv&min_price=200000&scenario_school_rating_delta=1",
      { cache: "no-store" },
    );
  });

  test("forwards equivalent CSV and PDF conditions and keeps the same analysis key", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);
        const extension = url.includes("format=csv") ? "csv" : "pdf";
        const type = extension === "csv" ? "text/csv" : "application/pdf";
        return new Response(new Uint8Array([1]), {
          headers: {
            "Content-Type": type,
            "Content-Disposition": `attachment; filename=property-market-analysis_${analysisKey}.${extension}`,
          },
        });
      });

    const csv = await GET(
      new Request(
        "http://localhost/api/market-analysis/export?format=csv&min_bedrooms=3.0&scenario_school_rating_delta=1.00",
      ),
    );
    const pdf = await GET(
      new Request(
        "http://localhost/api/market-analysis/export?scenario_school_rating_delta=1&format=pdf&min_bedrooms=3",
      ),
    );

    expect(csv.headers.get("Content-Disposition")).toBe(
      `attachment; filename=property-market-analysis_${analysisKey}.csv`,
    );
    expect(pdf.headers.get("Content-Disposition")).toBe(
      `attachment; filename=property-market-analysis_${analysisKey}.pdf`,
    );
    const csvQuery = new URL(String(fetchMock.mock.calls[0][0])).searchParams;
    const pdfQuery = new URL(String(fetchMock.mock.calls[1][0])).searchParams;
    csvQuery.delete("format");
    pdfQuery.delete("format");
    expect([...csvQuery.entries()]).toEqual([...pdfQuery.entries()]);
  });

  test.each([
    "format=csv&type=data",
    "type=data&format=csv",
    "format=csv&unknown_filter=1",
    "format=csv&min_price=1&min_price=2",
    "format=csv&chart_dimension=bedrooms",
    "format=csv&format=pdf",
    "format=csv&scenario_school_rating_delta=0",
    "format=csv&scenario_school_rating_delta=1&scenario_school_rating_delta=2",
    "format=csv&scenario_id=abc",
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

  test("returns a safe JSON error for a no-match export", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { detail: "No properties match the filters." },
        { status: 404 },
      ),
    );

    const response = await GET(
      new Request("http://localhost/api/market-analysis/export?format=csv"),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(await response.json()).toEqual({
      error: "No properties match the filters.",
    });
  });

  test("returns 503 when the market-analysis service is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("refused"));

    const response = await GET(
      new Request("http://localhost/api/market-analysis/export?format=csv"),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Market analysis service is unavailable.",
    });
  });

  test.each([
    new Response("bad type", {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename=property-market-analysis_${analysisKey}.csv`,
      },
    }),
    new Response("bad filename", {
      headers: { "Content-Type": "text/csv" },
    }),
    new Response("unsafe filename", {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="../../evil.csv"',
      },
    }),
  ])(
    "rejects successful upstream responses with invalid attachment metadata",
    async (upstream) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(upstream);

      const response = await GET(
        new Request("http://localhost/api/market-analysis/export?format=csv"),
      );

      expect(response.status).toBe(502);
      expect(response.headers.get("Content-Disposition")).toBeNull();
      expect(await response.json()).toEqual({
        error: "Market analysis service returned an invalid export.",
      });
    },
  );
});
