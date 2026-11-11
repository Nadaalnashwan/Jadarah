import "server-only";
import type { CandidateSkillRecord } from "@/lib/domain/matching";
import { overallScore, summariseInterviews, type Recommendation } from "@/lib/domain/final-evaluation";
import type { Locale } from "@/lib/i18n/config";
import type { createClient } from "@/lib/supabase/server";
import { matchJob } from "@/services/candidate";
import { getInterviewRubric } from "@/services/interview-rubric";
import { withSemantics } from "@/services/semantic";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
type EvalRow = {
  points: number | string;
  rubric_scores: unknown;
  comments: string | null;
  question: { prompt_en: string; prompt_ar: string; points: number } | null;
};

/**
 * Everything the Final Candidate Evaluation Report shows, gathered under the recruiter's session
 * (RLS scopes every query to their company). Pure facts + deterministic scores; no AI here.
 */
export async function loadFinalReport(supabase: ServerSupabase, applicationId: string, companyId: string, locale: Locale) {
  const { data: app } = await supabase
    .from("applications")
    .select(
      "id, status, was_shortlisted, submitted_at, candidate_id, job:jobs(id, title_en, title_ar, min_years, experience_level, job_skills(importance, min_level, skill:skills(id, name_en, name_ar))), candidate:profiles!applications_candidate_id_fkey(full_name)",
    )
    .eq("id", applicationId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!app || !app.job) return null;
  const cid = app.candidate_id;

  const [
    { data: cp },
    { data: skills },
    { data: education },
    { data: experience },
    { data: timeline },
    { data: assignments },
    { data: interviews },
    { data: fe },
    rubric,
  ] = await Promise.all([
    supabase.from("candidate_profiles").select("headline, summary, city, years_experience, experience_level").eq("user_id", cid).maybeSingle(),
    supabase.from("candidate_skills").select("level, source, evidence, years, skill:skills(id, name_en, name_ar)").eq("candidate_id", cid),
    supabase.from("candidate_education").select("degree, field, institution, end_date").eq("candidate_id", cid).order("end_date", { ascending: false }),
    supabase.from("candidate_experience").select("title, company, start_date, end_date, is_current, description").eq("candidate_id", cid).order("start_date", { ascending: false }),
    supabase.rpc("get_application_timeline", { p_app: applicationId }),
    supabase
      .from("assessment_assignments")
      .select(
        "id, status, submitted_at, assessment:assessments(title_en, title_ar, passing_score), submission:assessment_submissions(id, status, percentage, auto_score, manual_score, max_score, needs_review, evaluated_at, assessment_evaluations(question_id, points, rubric_scores, comments, question:assessment_questions(prompt_en, prompt_ar, points)))",
      )
      .eq("application_id", applicationId),
    supabase
      .from("interviews")
      .select(
        "id, title, type, status, scheduled_at, ends_at, timezone, interview_evaluations(ratings, recommendation, strengths, concerns, comments, submitted_at, interviewer:profiles!interview_evaluations_interviewer_id_fkey(full_name)), interview_attendance(role, joined_at, left_at)",
      )
      .eq("application_id", applicationId)
      .order("scheduled_at"),
    supabase
      .from("final_evaluations")
      .select(
        "*, final_evaluation_comments(id, body, created_at, author:profiles!final_evaluation_comments_author_id_fkey(full_name)), decider:profiles!final_evaluations_decided_by_fkey(full_name), ai_author:profiles!final_evaluations_ai_generated_by_fkey(full_name)",
      )
      .eq("application_id", applicationId)
      .maybeSingle(),
    getInterviewRubric(supabase, companyId),
  ]);

  // B. CV & semantic match (evidence-based score; semantic info is labelled inference).
  const records: CandidateSkillRecord[] = (skills ?? [])
    .filter((s) => s.skill)
    .map((s) => ({ skill_id: s.skill!.id, level: s.level, source: s.source as CandidateSkillRecord["source"], evidence: s.evidence, years: s.years }));
  const match = await withSemantics(supabase, matchJob(app.job, records, cp?.years_experience ?? null, locale), {
    candidateId: cid,
    jobId: app.job.id,
    candidateSkillIds: records.map((r) => r.skill_id),
    locale,
  });

  // C. Assessments: best evaluated/submitted percentage counts; none → null (not zero).
  const assessmentRows = (assignments ?? []).map((a) => {
    const sub = Array.isArray(a.submission) ? a.submission[0] : a.submission;
    return {
      id: a.id,
      title_en: a.assessment?.title_en ?? "",
      title_ar: a.assessment?.title_ar ?? "",
      passing: a.assessment?.passing_score ?? null,
      status: sub?.status ?? a.status,
      percentage: sub?.percentage ?? null,
      needsReview: Boolean(sub?.needs_review),
      evaluations: ((sub?.assessment_evaluations ?? []) as unknown as EvalRow[]).map((e) => ({
        prompt_en: e.question?.prompt_en ?? "",
        prompt_ar: e.question?.prompt_ar ?? "",
        points: Number(e.points),
        max: e.question?.points ?? null,
        comments: e.comments,
        rubric: (e.rubric_scores ?? {}) as Record<string, number>,
      })),
    };
  });
  const scored = assessmentRows.filter((a) => typeof a.percentage === "number");
  const assessmentScore = scored.length ? Math.round(Math.max(...scored.map((a) => Number(a.percentage)))) : null;

  // D. Interviews (structured rubric).
  const evals = (interviews ?? []).flatMap((iv) =>
    iv.interview_evaluations.map((e) => ({
      interviewer: e.interviewer?.full_name ?? "—",
      ratings: (e.ratings ?? {}) as Record<string, number>,
      recommendation: e.recommendation as Recommendation,
      strengths: e.strengths,
      concerns: e.concerns,
      comments: e.comments,
      interviewId: iv.id,
    })),
  );
  const interview = summariseInterviews(evals, rubric);
  const overall = overallScore({ match: match.score, assessment: assessmentScore, interview: interview.score });

  return {
    app,
    candidate: { name: app.candidate?.full_name ?? "—", profile: cp, education: education ?? [], experience: experience ?? [] },
    timeline: (timeline ?? []) as unknown as { to_status: string; created_at: string }[],
    match,
    assessments: assessmentRows,
    assessmentScore,
    interviews: interviews ?? [],
    evaluations: evals,
    interview,
    rubric,
    overall,
    final: fe,
  };
}

export type FinalReport = NonNullable<Awaited<ReturnType<typeof loadFinalReport>>>;

/**
 * Compact, de-identified evidence pack for the AI recommendation (no name, email, phone or other
 * personal identifiers; facts only, each tagged with its source).
 */
export function evidencePack(r: FinalReport) {
  return {
    role: { title: r.app.job!.title_en, level: r.app.job!.experience_level, min_years: r.app.job!.min_years },
    candidate: {
      headline: r.candidate.profile?.headline ?? null,
      years_experience: r.candidate.profile?.years_experience ?? null,
      education: r.candidate.education.map((e) => `${e.degree ?? ""} ${e.field ?? ""}`.trim()).slice(0, 3),
      experience: r.candidate.experience.map((e) => e.title).slice(0, 5),
    },
    cv_match: {
      evidence_score: r.match.score,
      requirements: r.match.requirements.map((q) => ({
        skill: q.name,
        importance: q.importance,
        status: q.status,
        required_level: q.required_level,
        candidate_level: q.candidate_level,
        evidence_source: q.source,
        related_skill_inference: q.related ? `${q.related.name} (${q.related.similarity.toFixed(2)})` : null,
      })),
      experience: r.match.experience,
      semantic_similarity_inference: r.match.semantic?.fit ?? null,
    },
    assessments: r.assessments.map((a) => ({
      title: a.title_en,
      percentage: a.percentage,
      passing: a.passing,
      awaiting_review: a.needsReview,
      reviewer_comments: a.evaluations.map((e) => e.comments).filter(Boolean).slice(0, 5),
    })),
    interviews: {
      rubric_averages: r.interview.criteria.map((c) => ({ criterion: c.name_en, average_1_to_5: c.average, ratings: c.ratings })),
      recommendations: r.interview.recommendations,
      interviewer_disagreement: r.interview.disagreement,
      strengths_noted: r.evaluations.map((e) => e.strengths).filter(Boolean).slice(0, 6),
      concerns_noted: r.evaluations.map((e) => e.concerns).filter(Boolean).slice(0, 6),
    },
    deterministic_overall: { score: r.overall.score, components: r.overall.components.map((c) => ({ c: c.key, v: c.value, w: c.effectiveWeight })) },
  };
}
