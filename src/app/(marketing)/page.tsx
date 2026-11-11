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
import { getShowcase } from "@/services/showcase";

export default async function LandingPage() {
  const showcase = await getShowcase();
  return (
    <>
      {/* Brand journey (optional, never a required step); "Skip" jumps to #after-city. */}
      <SaudiCity />
      <div id="after-city" tabIndex={-1} className="outline-none" />
      <ProblemComparison />
      <SolutionStages />
      <ProductShowcase data={showcase} />
      <AIPipeline />
      <CareerTransformation data={showcase} />
      <Audiences />
      <Closing />
    </>
  );
}
