/**
 * Verify AI providers before activation: model ID exists for this key, a real request
 * succeeds, output format is valid, latency is measured. Never prints keys or prompts.
 *
 *   npm run ai:verify            # all configured providers
 *   npm run ai:verify -- gemini  # one provider
 */
import { config } from "dotenv";
config({ path: ".env.local" });

type Result = { provider: string; model: string; status: string; detail: string };
const results: Result[] = [];
const only = process.argv[2];
const T = 30_000;

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const s = Date.now();
  const v = await fn();
  return [v, Date.now() - s];
}

async function listModels(url: string, headers: Record<string, string>, pick: (j: unknown) => string[]) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(T) });
  if (!res.ok) return { ok: false as const, status: res.status, body: (await res.text()).slice(0, 300) };
  return { ok: true as const, ids: pick(await res.json()) };
}

function similar(ids: string[], want: string) {
  const stem = want.split(/[-/]/).slice(0, 2).join("-");
  return ids.filter((i) => i.includes(stem) || i.includes(want.split("/").pop()!.split("-")[0])).slice(0, 12);
}

async function gemini() {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "";
  if (!key) return results.push({ provider: "gemini", model, status: "NOT CONFIGURED", detail: "GEMINI_API_KEY empty" });
  const h = { "x-goog-api-key": key };
  const lm = await listModels("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", h, (j) =>
    ((j as { models?: { name: string; supportedGenerationMethods?: string[] }[] }).models ?? []).map(
      (m) => `${m.name.replace(/^models\//, "")}[${(m.supportedGenerationMethods ?? []).join("|")}]`,
    ),
  );
  if (!lm.ok) return results.push({ provider: "gemini", model, status: "KEY REJECTED", detail: `HTTP ${lm.status} ${lm.body}` });
  const ids = lm.ids.map((x) => x.split("[")[0]);
  const flash = lm.ids.filter((x) => /flash/.test(x) && x.includes("generateContent")).map((x) => x.split("[")[0]);
  const embeds = lm.ids.filter((x) => x.includes("embedContent")).map((x) => x.split("[")[0]);
  console.log(`gemini: ${ids.length} models visible to this key`);
  console.log(`  flash (generateContent): ${flash.join(", ")}`);
  console.log(`  embedding models: ${embeds.join(", ")}`);

  if (!ids.includes(model)) {
    results.push({ provider: "gemini", model, status: "MODEL NOT FOUND", detail: `closest: ${similar(flash, model).join(", ")}` });
  } else {
    const [res, ms] = await timed(() =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: 'Return {"ok":true,"skill":"SQL"} exactly.' }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: {
              type: "object",
              properties: { ok: { type: "boolean" }, skill: { type: "string" } },
              required: ["ok", "skill"],
            },
          },
        }),
        signal: AbortSignal.timeout(T),
      }),
    );
    const body = await res.text();
    let detail = `HTTP ${res.status}, ${ms} ms`;
    let status = res.ok ? "OK" : "REQUEST FAILED";
    if (res.ok) {
      const txt = JSON.parse(body)?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("");
      try {
        const v = JSON.parse(txt);
        detail += `, structured JSON valid (ok=${v.ok}, skill=${v.skill})`;
      } catch {
        status = "BAD OUTPUT";
        detail += ", response was not valid JSON";
      }
    } else detail += ` ${body.slice(0, 300)}`;
    results.push({ provider: "gemini", model, status, detail });
  }

  const emodel = process.env.EMBEDDING_MODEL || "";
  const dims = Number(process.env.EMBEDDING_DIMENSIONS || 768);
  if (!embeds.includes(emodel)) {
    results.push({ provider: "gemini-embedding", model: emodel, status: "MODEL NOT FOUND", detail: `available: ${embeds.join(", ")}` });
  } else {
    const [res, ms] = await timed(() =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${emodel}:embedContent`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text: "React and TypeScript front-end development" }] }, taskType: "SEMANTIC_SIMILARITY", outputDimensionality: dims }),
        signal: AbortSignal.timeout(T),
      }),
    );
    const j = res.ok ? await res.json() : null;
    const len = j?.embedding?.values?.length ?? 0;
    results.push({
      provider: "gemini-embedding",
      model: emodel,
      status: res.ok && len === dims ? "OK" : "REQUEST FAILED",
      detail: res.ok ? `${len} dims (want ${dims}), ${ms} ms` : `HTTP ${res.status} ${(await res.text()).slice(0, 300)}`,
    });
  }
}

async function compat(provider: "groq" | "openai") {
  const key = provider === "groq" ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
  const model = (provider === "groq" ? process.env.GROQ_MODEL : process.env.OPENAI_MODEL) || "";
  const base = provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1";
  if (!key) return results.push({ provider, model, status: "NOT CONFIGURED", detail: `${provider.toUpperCase()}_API_KEY empty` });
  const h = { Authorization: `Bearer ${key}` };
  const lm = await listModels(`${base}/models`, h, (j) => ((j as { data?: { id: string }[] }).data ?? []).map((m) => m.id));
  if (!lm.ok) return results.push({ provider, model, status: "KEY REJECTED", detail: `HTTP ${lm.status} ${lm.body}` });
  console.log(`${provider}: ${lm.ids.length} models visible to this key`);
  if (!lm.ids.includes(model))
    return results.push({ provider, model, status: "MODEL NOT FOUND", detail: `closest: ${similar(lm.ids, model).join(", ")}` });
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: 'Return the JSON object {"ok":true,"skill":"SQL"} and nothing else.' }],
    response_format: { type: "json_object" },
  };
  if (provider === "groq" && model.startsWith("openai/gpt-oss")) body.reasoning_effort = "low";
  const [res, ms] = await timed(() =>
    fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(T * 2),
    }),
  );
  const text = await res.text();
  let status = res.ok ? "OK" : "REQUEST FAILED";
  let detail = `HTTP ${res.status}, ${ms} ms`;
  if (res.ok) {
    try {
      const v = JSON.parse(JSON.parse(text).choices[0].message.content);
      detail += `, JSON valid (ok=${v.ok}, skill=${v.skill})`;
    } catch {
      status = "BAD OUTPUT";
    }
  } else detail += ` ${text.slice(0, 300)}`;
  results.push({ provider, model, status, detail });
}

async function daily() {
  const key = process.env.DAILY_API_KEY;
  if (!key) return results.push({ provider: "daily", model: "-", status: "NOT CONFIGURED", detail: "DAILY_API_KEY empty" });
  const [res, ms] = await timed(() =>
    fetch("https://api.daily.co/v1/", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(T) }),
  );
  const j = res.ok ? await res.json() : null;
  results.push({
    provider: "daily",
    model: "-",
    status: res.ok ? "OK" : "KEY REJECTED",
    detail: res.ok ? `domain=${j?.domain_name ?? "?"}, ${ms} ms` : `HTTP ${res.status}`,
  });
}

(async () => {
  const tasks: [string, () => Promise<unknown>][] = [
    ["gemini", gemini],
    ["groq", () => compat("groq")],
    ["openai", () => compat("openai")],
    ["daily", daily],
  ];
  for (const [name, fn] of tasks) {
    if (only && only !== name) continue;
    try {
      await fn();
    } catch (e) {
      results.push({ provider: name, model: "", status: "ERROR", detail: e instanceof Error ? e.message : String(e) });
    }
  }
  console.log("\nRESULTS");
  for (const r of results) console.log(`- ${r.provider.padEnd(17)} ${r.model.padEnd(26)} ${r.status.padEnd(16)} ${r.detail}`);
})();
