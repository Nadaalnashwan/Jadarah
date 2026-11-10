import "server-only";
import { z } from "zod";
import { AIUnavailableError, generateJSON } from "./provider";

export const parsedCvSchema = z.object({
  full_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  education: z
    .array(
      z.object({
        institution: z.string(),
        degree: z.string(),
        field: z.string().nullable().optional(),
        end_year: z.string().nullable().optional(),
      }),
    )
    .default([]),
  experience: z
    .array(
      z.object({
        title: z.string(),
        company: z.string(),
        start: z.string().nullable().optional(),
        end: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
      }),
    )
    .default([]),
  skills: z
    .array(
      z.object({
        name: z.string(),
        evidence: z.string().nullable().optional(),
        kind: z.enum(["explicit", "inferred"]).default("explicit"),
      }),
    )
    .default([]),
  certifications: z.array(z.string()).default([]),
  projects: z
    .array(z.object({ title: z.string(), description: z.string().nullable().optional() }))
    .default([]),
  languages: z.array(z.string()).default([]),
});
export type ParsedCv = z.infer<typeof parsedCvSchema> & { method: "ai" | "rule_based"; provider: string };

const SYSTEM = `You extract structured data from a candidate's CV for a recruitment platform.
Rules: extract ONLY what the document states. Never invent employers, dates, degrees or skills.
For each skill include a short evidence quote from the CV. If a skill is not written but strongly implied, mark kind="inferred".
Return JSON matching the requested shape. Use null for unknown values.`;

export async function parseCvWithAI(
  userId: string,
  text: string,
  file?: { mimeType: string; base64: string },
): Promise<ParsedCv> {
  const { data, provider } = await generateJSON(
    {
      system: SYSTEM,
      operation: "cv_parse",
      userId,
      prompt: `Return JSON with keys: full_name, email, phone, headline, summary, education[{institution,degree,field,end_year}], experience[{title,company,start,end,description}], skills[{name,evidence,kind}], certifications[], projects[{title,description}], languages[].\n\nCV TEXT:\n${text.slice(0, 30_000)}`,
      file,
    },
    parsedCvSchema,
  );
  return { ...data, method: "ai", provider };
}

/**
 * Deterministic fallback when no AI provider is configured: matches the platform skill taxonomy
 * (names + aliases) against the CV text and extracts contact details with regexes.
 * Results are labelled rule-based and must be reviewed by the candidate.
 */
export function parseCvRuleBased(
  text: string,
  taxonomy: { name_en: string; aliases: string[]; slug: string }[],
): ParsedCv {
  const lower = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  const skills = taxonomy
    .filter((s) =>
      [s.name_en, ...s.aliases].some(
        (n) => n.length > 1 && new RegExp(`[^a-z0-9+#]${escapeRe(n.toLowerCase())}[^a-z0-9+#]`).test(lower),
      ),
    )
    .map((s) => {
      const idx = lower.indexOf(s.name_en.toLowerCase());
      const evidence =
        idx >= 0
          ? text
              .replace(/\s+/g, " ")
              .slice(Math.max(0, idx - 40), idx + s.name_en.length + 40)
              .trim()
          : null;
      return { name: s.name_en, evidence, kind: "explicit" as const };
    });
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  const phone = text.match(/(\+?966|0)5\d{8}/)?.[0] ?? null;
  return {
    full_name: null,
    email,
    phone,
    headline: null,
    summary: null,
    education: [],
    experience: [],
    skills,
    certifications: [],
    projects: [],
    languages: [],
    method: "rule_based",
    provider: "rule_based",
  };
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { AIUnavailableError };
