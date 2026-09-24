import { afterEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

const requestBody = {
  filters: { min_bedrooms: 3 },
  scenario: {
    adjustments: {
      school_rating_delta: 1,
      square_footage_percent: 5,
    },
  },
};

const metric = { mean: 100, median: 90, minimum: 50, maximum: 150 };
const result = {
  property_count: 2,
  baseline: metric,
  scenario: { mean: 110, median: 100, minimum: 60, maximum: 160 },
  impact: {
    mean: { absolute_change: 10, percentage_change: 10 },
    median: { absolute_change: 10, percentage_change: 11.11 },
    minimum: { absolute_change: 10, percentage_change: 20 },
    maximum: { absolute_change: 10, percentage_change: 6.67 },
  },
};

function request(body: string) {
  return new Request("http://localhost/api/market-analysis/price-impact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/market-analysis/price-impact", () => {
  test("forwards validated market filters and scenario adjustments", async () => {
    vi.stubEnv("MARKET_ANALYSIS_API_URL", "http://market:9002/");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(result));

    const response = await POST(request(JSON.stringify(requestBody)));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://market:9002/api/v1/market/price-impact",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        cache: "no-store",
      },
    );
  });

  test("returns 400 for malformed browser JSON", async () => {
    const response = await POST(request("{"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Request body must be valid JSON.",
    });
  });

  test.each([
    { baseline: {}, changes: { bedrooms: 4 } },
    {
      filters: { sort: "price" },
      scenario: { adjustments: { school_rating_delta: 1 } },
    },
    {
      filters: { min_bedrooms: 2.5 },
      scenario: { adjustments: { school_rating_delta: 1 } },
    },
    { filters: {}, scenario: { adjustments: {} } },
    { filters: {}, scenario: { adjustments: { school_rating_delta: 0 } } },
    { filters: {}, scenario: { adjustments: { unknown: 1 } } },
    { filters: {}, scenario: { adjustments: { school_rating_delta: "1" } } },
    { ...requestBody, extra: true },
  ])("returns 422 without forwarding invalid request %#", async (body) => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await POST(request(JSON.stringify(body)));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "Invalid price impact request.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("preserves a bounded upstream Problem Detail message and status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { detail: "No properties match the market filters." },
        { status: 422 },
      ),
    );

    const response = await POST(request(JSON.stringify(requestBody)));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "No properties match the market filters.",
    });
  });

  test("limits upstream detail strings to 500 characters", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ detail: "x".repeat(600) }, { status: 422 }),
    );

    const response = await POST(request(JSON.stringify(requestBody)));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "x".repeat(500) });
  });

  test("returns 503 when the market-analysis service cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("refused"));

    const response = await POST(request(JSON.stringify(requestBody)));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Market analysis service is unavailable.",
    });
  });

  test.each([
    new Response("not json", { status: 200 }),
    Response.json({ ...result, baseline: { ...result.baseline, mean: "100" } }),
  ])(
    "returns 502 for malformed successful upstream responses",
    async (upstream) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(upstream);

      const response = await POST(request(JSON.stringify(requestBody)));

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        error: "Market analysis service returned an invalid response.",
      });
    },
  );
});
