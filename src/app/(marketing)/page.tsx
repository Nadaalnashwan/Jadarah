import { CareerPath, Closing, EvidenceModel, HowItWorks } from "@/features/landing/sections";
import { SaudiCity } from "@/features/landing/saudi-city";

export default function LandingPage() {
  return (
    <>
      {/* Cinematic introduction over the 3D city; starts on load and loops. "Skip" jumps to #after-city. */}
      <SaudiCity />
      <div id="after-city" tabIndex={-1} className="outline-none" />
      <HowItWorks />
      <EvidenceModel />
      <CareerPath />
      <Closing />
    </>
  );
}
