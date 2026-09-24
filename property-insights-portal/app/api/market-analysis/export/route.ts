import {
  filterSearchParams,
  parseMarketQuery,
} from "@/lib/market-analysis/filters";

const defaultMarketAnalysisUrl = "http://localhost:9002";
const maximumProblemDetailLength = 500;

type ExportKind =
  | {
      type: "data";
      format: "csv";
      mediaType: "text/csv";
      filename: "properties.csv";
    }
  | {
      type: "report";
      format: "pdf";
      mediaType: "application/pdf";
      filename: "market-report.pdf";
    };

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

function readFilters(url: URL) {
  const filters = new URLSearchParams(url.searchParams);
  filters.delete("type");
  filters.delete("format");

  const values: Record<string, string | string[]> = {};
  for (const key of new Set(filters.keys())) {
    const all = filters.getAll(key);
    values[key] = all.length === 1 ? all[0] : all;
  }

  if (filters.has("chart_dimension")) return null;
  const parsed = parseMarketQuery(values);
  return parsed.ok ? parsed.filters : null;
}

function getExportKind(url: URL): ExportKind | null {
  const types = url.searchParams.getAll("type");
  const formats = url.searchParams.getAll("format");
  if (types.length !== 1 || formats.length !== 1) return null;
  if (types[0] === "data" && formats[0] === "csv") {
    return {
      type: "data",
      format: "csv",
      mediaType: "text/csv",
      filename: "properties.csv",
    };
  }
  if (types[0] === "report" && formats[0] === "pdf") {
    return {
      type: "report",
      format: "pdf",
      mediaType: "application/pdf",
      filename: "market-report.pdf",
    };
  }
  return null;
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const kind = getExportKind(incoming);
  if (!kind) return invalidExport();

  const filters = readFilters(incoming);
  if (!filters) {
    return Response.json({ error: "Invalid export filter." }, { status: 400 });
  }

  const query = new URLSearchParams({ type: kind.type, format: kind.format });
  filterSearchParams(filters).forEach((value, key) => query.append(key, value));
  const baseUrl = (
    process.env.MARKET_ANALYSIS_API_URL ?? defaultMarketAnalysisUrl
  ).replace(/\/$/, "");

  let upstream: Response;
  try {
    upstream = await fetch(
      `${baseUrl}/api/v1/properties/export?${query.toString()}`,
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

  const upstreamMediaType = upstream.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!upstream.body || upstreamMediaType !== kind.mediaType || !upstream.ok) {
    return Response.json(
      { error: "Market analysis service returned an invalid export." },
      { status: 502 },
    );
  }

  const headers = new Headers({
    "Content-Type": upstream.headers.get("Content-Type") ?? kind.mediaType,
    "Content-Disposition": `attachment; filename=${kind.filename}`,
    "Cache-Control": "no-store",
  });
  return new Response(upstream.body, { status: 200, headers });
}
