import { afterEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

const baseline = {
  square_footage: 1550,
  bedrooms: 3,
  bathrooms: 2,
  year_built: 1997,
  lot_size: 6800,
  distance_to_city_center: 4.1,
  school_rating: 7.6,
};

const result = {
  baseline,
  changes: { square_footage: { from: 1550, to: 1800 } },
  baseline_predicted_price: 420000,
  scenario_predicted_price: 465000,
  absolute_change: 45000,
  percentage_change: 10.71,
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
  test("forwards only a validated baseline and effective changes", async () => {
    vi.stubEnv("MARKET_ANALYSIS_API_URL", "http://market:9002/");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(result));

    const response = await POST(
      request(JSON.stringify({ baseline, changes: { square_footage: 1800 } })),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://market:9002/api/v1/properties/price-impact",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseline, changes: { square_footage: 1800 } }),
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
    { baseline, changes: {} },
    { baseline, changes: { square_footage: baseline.square_footage } },
    { baseline, changes: { square_footage: 0 } },
    { baseline: { ...baseline, id: 1 }, changes: { square_footage: 1800 } },
    { baseline, changes: { unknown_field: 1 } },
    { baseline, changes: { square_footage: 1800 }, scenario: baseline },
  ])(
    "returns 422 without forwarding an invalid or ineffective request",
    async (body) => {
      const fetchMock = vi.spyOn(globalThis, "fetch");

      const response = await POST(request(JSON.stringify(body)));

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        error: "Invalid price impact request.",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  test("preserves a bounded upstream Problem Detail message and status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { detail: "Input should be less than or equal to 10" },
        { status: 422 },
      ),
    );

    const response = await POST(
      request(JSON.stringify({ baseline, changes: { square_footage: 1800 } })),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "Input should be less than or equal to 10",
    });
  });

  test("limits upstream detail strings to 500 characters", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ detail: "x".repeat(600) }, { status: 422 }),
    );

    const response = await POST(
      request(JSON.stringify({ baseline, changes: { square_footage: 1800 } })),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "x".repeat(500) });
  });

  test("returns 503 when the market-analysis service cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("refused"));

    const response = await POST(
      request(JSON.stringify({ baseline, changes: { square_footage: 1800 } })),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Market analysis service is unavailable.",
    });
  });

  test.each([
    new Response("not json", { status: 200 }),
    Response.json({ ...result, baseline_predicted_price: "420000" }),
  ])(
    "returns 502 for malformed successful upstream responses",
    async (upstream) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(upstream);

      const response = await POST(
        request(
          JSON.stringify({ baseline, changes: { square_footage: 1800 } }),
        ),
      );

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        error: "Market analysis service returned an invalid response.",
      });
    },
  );
});
