import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Market Analysis",
};

export default function MarketAnalysisPage() {
  return (
    <section className="space-y-3">
      <h1 className="text-3xl font-bold">Property Market Analysis</h1>

      <p className="text-slate-600">
        This application will be implemented with the Java market-analysis
        service in the next project phase.
      </p>
    </section>
  );
}
