import { redirect } from "next/navigation";

/**
 * The standalone Talent Pool view was removed: candidates are reviewed through Jobs → Applications → Evaluation.
 * Candidate data, the candidates' visibility choice and the RLS rules it drives are unchanged.
 * Old links land on Applications.
 */
export default function TalentPoolRemoved() {
  redirect("/company/applications");
}
