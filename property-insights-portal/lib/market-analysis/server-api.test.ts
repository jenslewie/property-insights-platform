import { afterEach, expect, test, vi } from "vitest";
import { getMarketDashboard } from "./server-api";

function fixtureFor(url: string) {
  if (url.endsWith("/api/v1/properties")) {
    return { count: 0, properties: [] };
  }
  if (url.includes("/statistics/summary")) {
    return {
      total_count: 0,
      matched_count: 0,
      price: { mean: null, median: null, minimum: null, maximum: null },
    };
  }
  return {
    dimension: url.includes("/distributions/price") ? "price" : "bedrooms",
    matched_count: 0,
    buckets: [],
  };
}

function mockResponses(
  overrides: Partial<
    Record<
      "properties" | "summary" | "priceDistribution" | "featureDistribution",
      unknown
    >
  >,
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    const responseKey = url.endsWith("/api/v1/properties")
      ? "properties"
      : url.includes("/statistics/summary")
        ? "summary"
        : url.includes("/distributions/price")
          ? "priceDistribution"
          : "featureDistribution";
    return Response.json(overrides[responseKey] ?? fixtureFor(url));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

test("loads the list and filtered aggregate responses from Java", async () => {
  vi.stubEnv("MARKET_ANALYSIS_API_URL", "http://market:9002");
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) =>
      Response.json(fixtureFor(String(input))),
    );

  const result = await getMarketDashboard({ min_price: 200000 }, "bedrooms");

  expect(result.properties).toEqual({ count: 0, properties: [] });
  expect(fetchMock).toHaveBeenCalledWith(
    "http://market:9002/api/v1/properties",
    { cache: "no-store" },
  );
  expect(fetchMock).toHaveBeenCalledWith(
    "http://market:9002/api/v1/properties/statistics/summary?min_price=200000",
    { cache: "no-store" },
  );
  expect(fetchMock).toHaveBeenCalledWith(
    "http://market:9002/api/v1/properties/statistics/distributions/price?min_price=200000",
    { cache: "no-store" },
  );
  expect(fetchMock).toHaveBeenCalledWith(
    "http://market:9002/api/v1/properties/statistics/distributions/bedrooms?min_price=200000",
    { cache: "no-store" },
  );
});

test("maps a transport failure to a safe service error", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new TypeError("private host"),
  );

  await expect(getMarketDashboard({}, "square_footage")).rejects.toThrow(
    "Market analysis service is unavailable.",
  );
});

test("rejects a summary whose full sample count differs from the property list", async () => {
  mockResponses({
    summary: {
      total_count: 1,
      matched_count: 0,
      price: { mean: null, median: null, minimum: null, maximum: null },
    },
  });

  await expect(getMarketDashboard({}, "bedrooms")).rejects.toThrow(
    "Market analysis returned an invalid response.",
  );
});

test("rejects distributions whose matched count differs from the summary", async () => {
  mockResponses({
    priceDistribution: {
      dimension: "price",
      matched_count: 1,
      buckets: [
        {
          key: "all",
          label: "All prices",
          min_inclusive: null,
          max_exclusive: null,
          exact_value: null,
          count: 1,
          average_price: 200000,
        },
      ],
    },
  });

  await expect(getMarketDashboard({}, "bedrooms")).rejects.toThrow(
    "Market analysis returned an invalid response.",
  );
});

test("rejects a feature distribution for a different requested dimension", async () => {
  mockResponses({
    featureDistribution: {
      dimension: "bedrooms",
      matched_count: 0,
      buckets: [],
    },
  });

  await expect(getMarketDashboard({}, "square_footage")).rejects.toThrow(
    "Market analysis returned an invalid response.",
  );
});

test("rejects summary counts that disagree with locally matched list records", async () => {
  mockResponses({
    properties: {
      count: 1,
      properties: [
        {
          id: 1,
          square_footage: 1550,
          bedrooms: 3,
          bathrooms: 2,
          year_built: 1997,
          lot_size: 6800,
          distance_to_city_center: 4.1,
          school_rating: 7.6,
          price: 200000,
        },
      ],
    },
    summary: {
      total_count: 1,
      matched_count: 0,
      price: { mean: null, median: null, minimum: null, maximum: null },
    },
  });

  await expect(
    getMarketDashboard({ min_price: 200000 }, "bedrooms"),
  ).rejects.toThrow("Market analysis returned an invalid response.");
});

test("does not expose a malformed upstream response body", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("secret upstream body", { status: 200 }),
  );

  await expect(getMarketDashboard({}, "square_footage")).rejects.toThrow(
    "Market analysis returned an invalid response.",
  );
});
