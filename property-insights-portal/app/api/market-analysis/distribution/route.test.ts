import { afterEach, expect, test, vi } from "vitest";
import { GET } from "./route";

const distribution = {
  dimension: "bedrooms",
  matched_count: 2,
  buckets: [
    {
      key: "three",
      label: "3",
      min_inclusive: null,
      max_exclusive: null,
      exact_value: 3,
      count: 2,
      average_price: 210000,
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

test("proxies one validated feature distribution and preserves inclusive filters", async () => {
  vi.stubEnv("MARKET_ANALYSIS_API_URL", "http://market:9002/");
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json(distribution));

  const response = await GET(
    new Request(
      "http://localhost/api/market-analysis/distribution?dimension=bedrooms&min_bedrooms=3&max_bedrooms=4&min_price=200000",
    ),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(distribution);
  expect(fetchMock).toHaveBeenCalledWith(
    "http://market:9002/api/v1/market/distributions/bedrooms?min_bedrooms=3&max_bedrooms=4&min_price=200000",
    { cache: "no-store" },
  );
});

test.each([
  "min_price=200000",
  "dimension=price",
  "dimension=unknown",
  "dimension=bedrooms&dimension=bathrooms",
  "dimension=bedrooms&min_price=1&min_price=2",
  "dimension=bedrooms&unknown=1",
  "dimension=bedrooms&chart_dimension=bathrooms",
  "dimension=bedrooms&min_bedrooms=4&max_bedrooms=3",
  "dimension=bedrooms&min_square_footage=1.5",
])(
  "rejects invalid distribution query %s without an upstream request",
  async (query) => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await GET(
      new Request("http://localhost/api/market-analysis/distribution?" + query),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("error");
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test("rejects an upstream distribution for the wrong feature", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ ...distribution, dimension: "bathrooms" }),
  );

  const response = await GET(
    new Request(
      "http://localhost/api/market-analysis/distribution?dimension=bedrooms",
    ),
  );

  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({
    error: "Market analysis returned an invalid response.",
  });
});

test("maps upstream connection failures to a service unavailable response", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(
    new TypeError("private host"),
  );

  const response = await GET(
    new Request(
      "http://localhost/api/market-analysis/distribution?dimension=bedrooms",
    ),
  );

  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: "Market analysis service is unavailable.",
  });
});
