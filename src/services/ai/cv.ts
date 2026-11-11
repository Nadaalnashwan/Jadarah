import "server-only";
import { z } from "zod";
import type { CvGrounding } from "@/lib/domain/cv-grounding";
import { parseCvRules } from "@/lib/domain/cv-rules";
import { parsedCvSchemaShape } from "./cv-schema";
import { AIUnavailableError, generateJSON } from "./provider";

export const parsedCvSchema = parsedCvSchemaShape;
export type ParsedCv = z.infer<typeof parsedCvSchema> & {
  method: "ai" | "rule_based";
  provider: string;
  /** Which extracted items were found in the CV's own text (see lib/domain/cv-grounding). */
  grounding?: CvGrounding;
};

const SYSTEM = `You extract structured data from a candidate's CV for a recruitment platform.
Rules: extract ONLY what the document states. Never invent employers, dates, degrees or skills.
For each skill include a short evidence quote from the CV. If a skill is not written but strongly implied, mark kind="inferred".
Return JSON matching the requested shape. Use null for unknown values.`;

export async function parseCvWithAI(
  userId: string,
  text: string,
  file?: { mimeType: string; base64: string },
): Promise<ParsedCv> {
  const { data, provider, model } = await generateJSON(
    {
      system: SYSTEM,
      operation: "cv_parse",
      userId,
      prompt: `Return JSON with keys: full_name, email, phone, headline, summary, education[{institution,degree,field,end_year}], experience[{title,company,start,end,description}], skills[{name,evidence,kind}], certifications[], projects[{title,description}], languages[].\n\nCV TEXT:\n${text.slice(0, 30_000)}`,
      file,
    },
    parsedCvSchema,
  );
  return { ...data, method: "ai", provider: `${provider} · ${model}` };
}

/** Rule-based fallback; see lib/domain/cv-rules. */
export function parseCvRuleBased(text: string, taxonomy: { name_en: string; aliases: string[]; slug: string }[]): ParsedCv {
  return parseCvRules(text, taxonomy) as ParsedCv;
}

export { AIUnavailableError };
