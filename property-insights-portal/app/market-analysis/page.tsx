import type { Metadata } from "next";
import Link from "next/link";
import { getMarketDashboard } from "@/lib/market-analysis/server-api";
import { parseMarketQuery } from "@/lib/market-analysis/filters";
import { MarketWorkspace } from "@/components/market-analysis/market-workspace";

export const metadata: Metadata = {
  title: "Market Analysis",
};

type MarketAnalysisPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MarketAnalysisPage({
  searchParams,
}: MarketAnalysisPageProps) {
  const parsed = parseMarketQuery(await searchParams);

  if (!parsed.ok) {
    return (
      <section className="space-y-4" aria-labelledby="market-analysis-title">
        <h1 className="text-3xl font-bold" id="market-analysis-title">
          Property Market Analysis
        </h1>
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950"
          role="alert"
        >
          <p>{parsed.error} Review the URL filters or reset them.</p>
          <Link
            className="mt-3 inline-flex font-semibold underline underline-offset-4"
            href="/market-analysis"
          >
            Reset filters
          </Link>
        </div>
      </section>
    );
  }

  const data = await getMarketDashboard(parsed.filters, parsed.dimension);

  return (
    <section className="space-y-8" aria-labelledby="market-analysis-title">
      <header className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-bold" id="market-analysis-title">
          Property Market Analysis
        </h1>
        <p className="text-slate-600">
          Explore historical price statistics and evaluate model-predicted price
          impacts across the supplied housing sample.
        </p>
      </header>
      <MarketWorkspace
        data={data}
        filters={parsed.filters}
        scenario={parsed.scenario}
        dimension={parsed.dimension}
      />
    </section>
  );
}
