import {
  AIPipeline,
  Audiences,
  CareerTransformation,
  Closing,
  Hero,
  ProblemComparison,
  ProductShowcase,
  SolutionStages,
} from "@/features/landing/sections";
import { getShowcase } from "@/services/showcase";

export default async function LandingPage() {
  const showcase = await getShowcase();
  return (
    <>
      <Hero />
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
