"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section
      className="rounded-2xl border border-red-200 bg-red-50 p-6"
      role="alert"
    >
      <h1 className="text-2xl font-semibold text-red-900">
        Property Insights could not display this page.
      </h1>
      <p className="mt-2 text-red-800">
        Try the request again or return through the main navigation.
      </p>
      <button
        className="mt-4 rounded-lg bg-red-800 px-4 py-2 font-semibold text-white"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </section>
  );
}
