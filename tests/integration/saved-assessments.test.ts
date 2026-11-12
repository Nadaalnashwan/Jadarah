import { describe, expect, it } from "vitest";
import { as, integrationEnabled } from "./helpers";

/**
 * The five Assessment Builder drafts generated on 2026-11-11 (real AI output, kept for owner review).
 * Read-only checks: nothing is generated, published or deleted. The only write is a no-op rubric
 * update (same value) proving the owning company's reviewer is allowed to edit the rubric.
 */
const SAVED = [
  { id: "469cf06b-5abd-45d7-8def-fcde2012edcc", owner: "recruiter.elm", outsider: "recruiter.sdaia" },
  { id: "8b722600-2aa2-45eb-b6cd-0cfeb608ae62", owner: "recruiter.sdaia", outsider: "recruiter.elm" },
  { id: "2baae631-cf86-482e-a5da-d7c305e4eeea", owner: "recruiter.mof", outsider: "recruiter.gea" },
  { id: "ca322235-3346-4c0b-abbd-bc3c116fbddf", owner: "recruiter.gea", outsider: "recruiter.mof" },
  { id: "107494cd-3df3-4051-a90b-ec47cbff1cad", owner: "recruiter.sipchem", outsider: "recruiter.stc" },
];
const LEGACY = /midan|almidan|الميدان/i;

describe.skipIf(!integrationEnabled)("saved Assessment Builder drafts (live, read-only)", () => {
  for (const s of SAVED) {
    it(`${s.owner.split(".")[1]}: draft accessible to its company only; files and guide stay private`, async () => {
      const owner = await as(s.owner);
      const { data: a, error } = await owner
        .from("assessments")
        .select("id, status, company_id, title_en, title_ar, description_en")
        .eq("id", s.id)
        .single();
      expect(error).toBeNull();
      expect(a!.status).toBe("draft");

      const { data: qs } = await owner
        .from("assessment_questions")
        .select("prompt_en, prompt_ar")
        .eq("assessment_id", s.id);
      expect((qs ?? []).length).toBeGreaterThanOrEqual(2);
      const { data: rub } = await owner
        .from("assessment_rubrics")
        .select("id, title_en, criteria")
        .eq("assessment_id", s.id)
        .order("created_at", { ascending: true });
      // The original overall rubric is the oldest row; later per-question rubrics may be derived from it.
      expect((rub ?? []).length).toBeGreaterThanOrEqual(1);
      expect(rub![0].title_en).toBe("Practical rubric");
      expect(Array.isArray(rub![0].criteria) && (rub![0].criteria as unknown[]).length > 0).toBe(true);
      const { data: guide } = await owner
        .from("assessment_assessor_guides")
        .select("guide")
        .eq("assessment_id", s.id);
      expect(guide ?? []).toHaveLength(1);
      expect(JSON.stringify([a, qs, rub])).not.toMatch(LEGACY);

      // Rubric is editable by the owning reviewer (no-op write: same value).
      const { data: upd, error: uErr } = await owner
        .from("assessment_rubrics")
        .update({ title_en: rub![0].title_en })
        .eq("id", rub![0].id)
        .select("id");
      expect(uErr).toBeNull();
      expect(upd ?? []).toHaveLength(1);

      // Candidate CSVs are stored and downloadable by the owning company.
      const { data: mats } = await owner
        .from("assessment_materials")
        .select("audience, file_name, storage_path")
        .eq("assessment_id", s.id);
      const csvs = (mats ?? []).filter((m) => m.audience === "candidate" && m.file_name.endsWith(".csv"));
      expect(csvs.length).toBeGreaterThanOrEqual(1);
      for (const m of csvs) {
        const { data: blob, error: dErr } = await owner.storage
          .from("assessment-materials")
          .download(m.storage_path);
        expect(dErr).toBeNull();
        const text = await blob!.text();
        expect(text.split("\n").length).toBeGreaterThan(2);
        expect(text).not.toMatch(LEGACY);
      }

      // Another organization's recruiter sees nothing.
      const outsider = await as(s.outsider);
      expect((await outsider.from("assessments").select("id").eq("id", s.id)).data ?? []).toHaveLength(0);
      expect(
        (await outsider.from("assessment_assessor_guides").select("guide").eq("assessment_id", s.id)).data ??
          [],
      ).toHaveLength(0);
      expect(
        (await outsider.storage.from("assessment-materials").createSignedUrl(csvs[0].storage_path, 60)).error,
      ).not.toBeNull();

      // A candidate (not assigned — drafts are never assigned) sees nothing, especially not the assessor guide.
      const candidate = await as("candidate05");
      expect((await candidate.from("assessments").select("id").eq("id", s.id)).data ?? []).toHaveLength(0);
      expect(
        (await candidate.from("assessment_assessor_guides").select("guide").eq("assessment_id", s.id)).data ??
          [],
      ).toHaveLength(0);
      expect(
        (await candidate.from("assessment_materials").select("id").eq("assessment_id", s.id)).data ?? [],
      ).toHaveLength(0);
      expect(
        (await candidate.storage.from("assessment-materials").download(csvs[0].storage_path)).error,
      ).not.toBeNull();
    }, 60_000);
  }
});
