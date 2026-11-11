import {
  AIPipeline,
  Audiences,
  CareerTransformation,
  Closing,
  ProblemComparison,
  ProductShowcase,
  SolutionStages,
} from "@/features/landing/sections";
import { SaudiCity } from "@/features/landing/saudi-city";

export default function LandingPage() {
  return (
    <>
      {/* Cinematic introduction over the 3D Riyadh skyline (opening → candidates → companies); "Skip" jumps to #after-city. */}
      <SaudiCity />
      <div id="after-city" tabIndex={-1} className="outline-none" />
      <ProblemComparison />
      <SolutionStages />
      <ProductShowcase />
      <AIPipeline />
      <CareerTransformation />
      <Audiences />
      <Closing />
    </>
  );
}
