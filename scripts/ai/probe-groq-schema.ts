/** Dev probe: Groq structured outputs (json_schema) with production schemas. No secrets printed. */
process.loadEnvFile(".env.local");
import { z } from "zod";
import { parsedCvSchemaShape } from "../../src/services/ai/cv-schema";
const questions = z.object({ questions: z.array(z.object({ question: z.string().max(400), kind: z.enum(["technical", "behavioral", "role", "follow_up"]) })).max(10) });
const toJs = (s: z.ZodTypeAny) => { const j = z.toJSONSchema(s, { io: "input", unrepresentable: "any" }) as Record<string, unknown>; delete j.$schema; return j; };
(async () => {
  for (const [name, schema, prompt] of [
    ["interview_questions", questions, "Suggest 5 interview questions for a Senior Data Analyst (SQL, Power BI). Mix technical, behavioral, role, follow_up."],
    ["cv_parse", parsedCvSchemaShape, "Extract from this CV: Layla Al-Harbi, Data Analyst at Rafd Analytics (2022-present). Built Power BI dashboards and SQL over PostgreSQL; Python pandas. BSc Statistics, Imam University 2022. Arabic, English."],
  ] as const) {
    const s = Date.now();
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.GROQ_MODEL, reasoning_effort: "low", messages: [{ role: "system", content: "Return JSON only." }, { role: "user", content: prompt }],
        response_format: { type: "json_schema", json_schema: { name: "result", schema: toJs(schema), strict: false } } }),
    });
    const j = await r.json();
    if (!r.ok) { console.log(name, r.status, j.error?.message?.slice(0, 250)); continue; }
    const p = schema.safeParse(JSON.parse(j.choices[0].message.content));
    console.log(name, r.status, Date.now() - s, "ms", p.success ? "VALID" : "INVALID " + JSON.stringify(p.error.issues.slice(0, 3)));
  }
})();
