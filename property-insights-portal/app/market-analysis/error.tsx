"use client";

export default function MarketAnalysisError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      className="rounded-2xl border border-red-200 bg-red-50 p-6"
      role="alert"
    >
      <h1 className="text-2xl font-semibold text-red-900">
        Market analysis could not load.
      </h1>
      <p className="mt-2 text-red-800">
        The market service returned an error or an invalid response.
      </p>
      <button
        className="mt-4 rounded-lg bg-red-800 px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-900"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </section>
  );
}
