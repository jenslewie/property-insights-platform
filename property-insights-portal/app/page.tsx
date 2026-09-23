import Link from "next/link";

const applications = [
  {
    title: "Property Value Estimator",
    description:
      "Estimate one property, retain previous results, and compare values.",
    href: "/property-estimator",
    action: "Open Property Value Estimator",
  },
  {
    title: "Property Market Analysis",
    description:
      "Explore property segments, market statistics, and what-if scenarios.",
    href: "/market-analysis",
    action: "View Market Analysis",
  },
];

export default function Home() {
  return (
    <section className="space-y-8">
      <div className="max-w-3xl space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
          Unified portal
        </p>

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Make property decisions with clearer evidence.
        </h1>

        <p className="text-lg text-slate-600">
          Choose an application to estimate a property or explore the wider
          market.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {applications.map((application) => (
          <article
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            key={application.href}
          >
            <h2 className="text-2xl font-semibold">{application.title}</h2>

            <p className="mt-3 text-slate-600">{application.description}</p>

            <Link
              className="mt-6 inline-flex font-semibold text-blue-700 underline-offset-4 hover:underline"
              href={application.href}
            >
              {application.action}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
