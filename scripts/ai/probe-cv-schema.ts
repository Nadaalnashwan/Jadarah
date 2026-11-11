/** Dev probe: real Gemini structured-output call with the production CV schema. No secrets printed. */
process.loadEnvFile(".env.local");
import { z } from "zod";
import { parsedCvSchemaShape } from "../../src/services/ai/cv-schema";
const schema = parsedCvSchemaShape;
const js = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
delete js.$schema;
const cv = `Sara Al-Qahtani — Front-end Developer, Riyadh. sara@example.com, 0551234567.
Experience: Front-end Developer, Tamkeen Tech (2021–present): built React + TypeScript dashboards, led migration to Next.js, wrote Jest tests.
Education: BSc Computer Science, King Saud University, 2021. Certifications: AWS Cloud Practitioner. Languages: Arabic, English.`;
(async () => {
for (const model of [process.env.GEMINI_MODEL!, process.env.GEMINI_FALLBACK_MODEL!]) {
  const s = Date.now();
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Extract ONLY what the CV states. Include a short evidence quote per skill. Return JSON." }] },
        contents: [{ role: "user", parts: [{ text: cv }] }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: js, temperature: 0.2, thinkingConfig: { thinkingLevel: "low" } },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const j = await r.json();
    if (!r.ok) { console.log(model, r.status, Date.now() - s, "ms", j.error?.message?.slice(0, 200)); continue; }
    const parsed = schema.safeParse(JSON.parse(j.candidates[0].content.parts.map((p: { text: string }) => p.text).join("")));
    console.log(model, r.status, Date.now() - s, "ms", "schema", parsed.success ? "VALID" : "INVALID");
    if (parsed.success) console.log("  skills:", parsed.data.skills.map((x) => `${x.name}(${x.kind})`).join(", "), "| exp:", parsed.data.experience.length, "| edu:", parsed.data.education.length);
  } catch (e) { console.log(model, "ERR", Date.now() - s, "ms", (e as Error).message); }
}
})();
