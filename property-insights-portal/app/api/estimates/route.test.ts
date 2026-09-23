import { afterEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

const property = {
  square_footage: 1550,
  bedrooms: 3,
  bathrooms: 2,
  year_built: 1997,
  lot_size: 6800,
  distance_to_city_center: 4.1,
  school_rating: 7.6,
};

const estimate = {
  property,
  predicted_price: 250879.73,
};

const secondProperty = {
  square_footage: 2200,
  bedrooms: 4,
  bathrooms: 2.5,
  year_built: 2008,
  lot_size: 9600,
  distance_to_city_center: 7,
  school_rating: 8.8,
};

const batchEstimate = {
  count: 2,
  estimates: [
    estimate,
    {
      property: secondProperty,
      predicted_price: 364551.64,
    },
  ],
};

function request(body: string) {
  return new Request("http://localhost/api/estimates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/estimates", () => {
  test("forwards a property and returns a validated estimate", async () => {
    vi.stubEnv("PROPERTY_ESTIMATOR_API_URL", "http://estimator:9001");

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(estimate, { status: 200 }));

    const response = await POST(request(JSON.stringify(property)));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(estimate);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://estimator:9001/api/v1/estimate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(property),
      }),
    );
  });

  test("forwards a property batch and returns validated estimates", async () => {
    vi.stubEnv("PROPERTY_ESTIMATOR_API_URL", "http://estimator:9001");

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(batchEstimate, { status: 200 }));

    const properties = [property, secondProperty];
    const response = await POST(request(JSON.stringify(properties)));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(batchEstimate);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://estimator:9001/api/v1/estimate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(properties),
      }),
    );
  });

  test("returns 400 for malformed browser JSON", async () => {
    const response = await POST(request("{"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Request body must be valid JSON.",
    });
  });

  test("preserves an upstream validation status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          detail: [
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

    const response = await POST(request(JSON.stringify(property)));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "Request validation failed.",
      fieldErrors: [
        {
          loc: ["body", "PropertyFeatures", "square_footage"],
          msg: "Input should be greater than 0",
          type: "greater_than",
        },
      ],
    });
  });

  test("preserves indexed batch validation details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          detail: [
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

    const response = await POST(request(JSON.stringify([property, property])));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "Request validation failed.",
      fieldErrors: [
        {
          loc: ["body", "list[PropertyFeatures]", 1, "bedrooms"],
          msg: "Input should be less than or equal to 10",
          type: "less_than_equal",
        },
      ],
    });
  });

  test("returns 503 when the estimator cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("connection refused"),
    );

    const response = await POST(request(JSON.stringify(property)));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Property estimator service is unavailable.",
    });
  });

  test("returns 502 for a non-JSON upstream response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("bad gateway", { status: 502 }),
    );

    const response = await POST(request(JSON.stringify(property)));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Property estimator service returned an invalid response.",
    });
  });

  test("returns 502 for an invalid successful payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ price: "unknown" }),
    );

    const response = await POST(request(JSON.stringify(property)));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Property estimator service returned an invalid response.",
    });
  });

  test.each([
    { count: 0, estimates: [] },
    { count: 2, estimates: [estimate] },
  ])("returns 502 for an inconsistent batch payload", async (payload) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(payload));

    const response = await POST(request(JSON.stringify([property])));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Property estimator service returned an invalid response.",
    });
  });

  test("returns 502 for a response that mixes single and batch envelopes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        ...estimate,
        count: 0,
        estimates: [],
      }),
    );

    const response = await POST(request(JSON.stringify(property)));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Property estimator service returned an invalid response.",
    });
  });
});
