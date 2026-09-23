import type { Metadata } from "next";
import { EstimatorWorkspace } from "@/components/property-estimator/estimator-workspace";

export const metadata: Metadata = {
  title: "Property Estimator",
};

export default function PropertyEstimatorPage() {
  return (
    <section className="space-y-8">
      <div className="max-w-3xl space-y-2">
        <h1 className="text-3xl font-bold">Property Value Estimator</h1>
        <p className="text-slate-600">
          Enter property details to request a prediction from the trained
          housing model.
        </p>
      </div>

      <EstimatorWorkspace />
    </section>
  );
}
