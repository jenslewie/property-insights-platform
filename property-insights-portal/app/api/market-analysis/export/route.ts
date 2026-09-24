import {
  conditionSearchParams,
  parseMarketQuery,
} from "@/lib/market-analysis/filters";

const defaultMarketAnalysisUrl = "http://localhost:9002";
const maximumProblemDetailLength = 500;

type ExportFormat = "csv" | "pdf";

function invalidExport() {
  return Response.json({ error: "Unsupported export." }, { status: 400 });
}

function safeProblemDetail(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "detail" in payload &&
    typeof payload.detail === "string" &&
    payload.detail.trim().length > 0
  ) {
    return payload.detail.slice(0, maximumProblemDetailLength);
  }
  return "The requested export is unavailable.";
}

function readConditions(url: URL): {
  format: ExportFormat;
  query: URLSearchParams;
} | null {
  const formats = url.searchParams.getAll("format");
  if (formats.length !== 1 || (formats[0] !== "csv" && formats[0] !== "pdf")) {
    return null;
  }
  if (url.searchParams.has("chart_dimension")) return null;

  const values: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    if (key === "format") continue;
    const all = url.searchParams.getAll(key);
    values[key] = all.length === 1 ? all[0] : all;
  }

  const parsed = parseMarketQuery(values);
  if (!parsed.ok) return null;

  const query = new URLSearchParams({ format: formats[0] });
  conditionSearchParams(parsed.filters, parsed.scenario).forEach((value, key) =>
    query.append(key, value),
  );
  return { format: formats[0], query };
}

function safeFilename(
  value: string | null,
  format: ExportFormat,
): string | null {
  if (!value) return null;
  const match =
    /^attachment;\s*filename="?(property-market-analysis_[a-f0-9]{8}\.(csv|pdf))"?$/i.exec(
      value,
    );
  if (!match || match[2] !== format) return null;
  return match[1];
}

export async function GET(request: Request) {
  const conditions = readConditions(new URL(request.url));
  if (!conditions) return invalidExport();

  const baseUrl = (
    process.env.MARKET_ANALYSIS_API_URL ?? defaultMarketAnalysisUrl
  ).replace(/\/$/, "");

  let upstream: Response;
  try {
    upstream = await fetch(
      `${baseUrl}/api/v1/market/export?${conditions.query.toString()}`,
      { cache: "no-store" },
    );
  } catch {
    return Response.json(
      { error: "Market analysis service is unavailable." },
      { status: 503 },
    );
  }

  if (upstream.status !== 200) {
    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      payload = null;
    }
    const status = upstream.status >= 400 ? upstream.status : 502;
    return Response.json({ error: safeProblemDetail(payload) }, { status });
  }

  const expectedMediaType =
    conditions.format === "csv" ? "text/csv" : "application/pdf";
  const upstreamMediaType = upstream.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  const filename = safeFilename(
    upstream.headers.get("Content-Disposition"),
    conditions.format,
  );
  if (!upstream.body || upstreamMediaType !== expectedMediaType || !filename) {
    return Response.json(
      { error: "Market analysis service returned an invalid export." },
      { status: 502 },
    );
  }

  const headers = new Headers({
    "Content-Type": upstream.headers.get("Content-Type") ?? expectedMediaType,
    "Content-Disposition": `attachment; filename=${filename}`,
    "Cache-Control": "no-store",
  });
  return new Response(upstream.body, { status: 200, headers });
}
