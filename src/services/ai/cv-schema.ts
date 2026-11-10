import { z } from "zod";

/** Shared (non server-only) CV extraction schema. */
export const parsedCvSchemaShape = z.object({
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
