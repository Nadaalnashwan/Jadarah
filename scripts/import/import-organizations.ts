/**
 * Idempotent import of the initial organizations from the employer registry workbook.
 *   npx tsx scripts/import/import-organizations.ts "<extracted package dir>" [--dry-run]
 *
 * - Keyed by registry_id (ALM-xxx); internal UUIDs preserved; reruns update only these rows.
 * - Never renames or remaps existing (fictional) organizations, users or history.
 * - Brand assets: none asserted. Workbook marks logo/colours/usage as not verified → neutral fallback.
 * - Subscriptions: controlled DEMONSTRATION access (is_demo, payment_status 'demo', no price) — not revenue.
 * - Demo employee identities are fictional, labelled as demo, and use the existing demo password.
 * - Opportunities: SIMULATION listings only (the workbook's Jadarat Jobs sheet has no records).
 * Uses the service-role key (scripts only). Prints no secrets.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { Database } from "../../src/types/database";
import { ORGS } from "./organizations-data";
import { readXlsx } from "./xlsx";

config({ path: ".env.local", quiet: true });
const root = process.argv[2];
const dry = process.argv.includes("--dry-run");
const REL = "03_Reference_Data/ALMIDAN_Employer_Database_10_Entities.xlsx";
const SHORT: Record<string, string> = {
  "ALM-001": "mc", "ALM-002": "gea", "ALM-003": "elm", "ALM-004": "dgda", "ALM-005": "stc",
  "ALM-006": "sdaia", "ALM-007": "sipchem", "ALM-008": "srsa", "ALM-009": "mof", "ALM-010": "sidf",
};
const ROLE_LABEL = { company_admin: "Company Admin", recruiter: "Recruiter", interviewer: "Interviewer" } as const;
const TYPE_AR: Record<string, string> = {};

function table(sheet: { rows: string[][] }) {
  const [hdr, ...rows] = sheet.rows;
  return rows.map((r) => Object.fromEntries(hdr.map((h, i) => [h, (r[i] ?? "").trim()])));
}

(async () => {
  const file = join(root, REL);
  const sha = createHash("sha256").update(readFileSync(file)).digest("hex");
  const sheets = Object.fromEntries(readXlsx(file).map((s) => [s.name, table(s)]));
  const employers = sheets["Employers"];
  const brands = new Map(sheets["Brand Profiles"].map((b) => [b.company_id, b]));
  const sources = new Map(sheets["Sources"].map((s) => [s.company_id, s]));
  const aliases = sheets["Employer Aliases"];
  console.log(`registry rows=${employers.length} jobs_sheet_rows=${sheets["Jadarat Jobs"].length} sha256=${sha.slice(0, 12)}…`);
  if (employers.length !== 10) throw new Error("expected 10 registry rows");

  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const demoPassword = process.env.DEMO_USER_PASSWORD;
  if (!demoPassword) throw new Error("DEMO_USER_PASSWORD missing");
  const { data: skills } = await db.from("skills").select("id, slug");
  const skillId = new Map((skills ?? []).map((s) => [s.slug, s.id]));
  const { data: cats } = await db.from("job_categories").select("id, slug");
  const catId = new Map((cats ?? []).map((c) => [c.slug, c.id]));
  const { data: existingUsers } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const userByEmail = new Map((existingUsers?.users ?? []).map((u) => [u.email?.toLowerCase(), u.id]));

  const summary: string[] = [];
  for (const e of employers) {
    const reg = e.company_id;
    const meta = ORGS[reg];
    if (!meta) throw new Error(`no curated data for ${reg}`);
    const src = sources.get(reg);
    const brand = brands.get(reg);
    const provenance = {
      registry_id: reg,
      registry_file: "employer_registry.xlsx",
      registry_sha256: sha,
      verification_source: e.verification_source || null,
      source_url: src?.source_url || null,
      source_type: src?.source_type || null,
      checked_on: src?.checked_on || null,
      registry_notes: e.notes || null,
      imported_at: new Date().toISOString(),
    };
    const row = {
      registry_id: reg,
      name_en: e.name_en,
      name_ar: e.name_ar,
      organization_type: e.entity_type,
      sector_en: e.sector,
      sector_ar: meta.sector_ar,
      industry: e.sector,
      website: e.official_website || null,
      careers_url: e.career_url || null,
      verification_status: e.verification_status as "verified_official" | "pending_live_verification",
      partnership_status: "not_partner" as const,
      city: meta.city,
      country: "Saudi Arabia",
      listed: true,
      accepts_access_requests: true,
      status: "approved" as const,
      is_demo: false, // real organizations; demo nature lives on the subscription
      provenance,
    };
    const { data: found } = await db.from("company_profiles").select("id, slug").eq("registry_id", reg).maybeSingle();
    let companyId = found?.id;
    if (dry) {
      summary.push(`${reg} ${e.name_en}: ${found ? "update" : "insert"}`);
      continue;
    }
    if (companyId) {
      const { error } = await db.from("company_profiles").update(row).eq("id", companyId);
      if (error) throw error;
    } else {
      const { data, error } = await db
        .from("company_profiles")
        .insert({ ...row, slug: meta.slug, approved_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error) throw error;
      companyId = data.id;
    }

    // Brand profile: nothing asserted (workbook: not_verified / permission_not_verified).
    await db.from("company_brand_profiles").upsert(
      {
        company_id: companyId,
        logo_path: null,
        logo_source_url: brand?.logo_asset_url || null,
        primary_hex: brand?.primary_hex || null,
        secondary_hex: brand?.secondary_hex || null,
        brand_source: brand?.official_website || null,
        identity_status: "not_verified",
        usage_permission: "not_verified",
        notes: "Brand assets and usage permission not verified in the source registry; neutral name-based identity in use.",
      },
      { onConflict: "company_id" },
    );
    for (const a of aliases.filter((x) => x.company_id === reg))
      await db.from("company_aliases").upsert(
        { company_id: companyId, alias: a.name_variant, language: a.language || "ar", alias_status: a.alias_status || "common" },
        { onConflict: "company_id,alias" },
      );

    // Controlled demonstration access (no commercial agreement on record).
    const { data: sub } = await db.from("company_subscriptions").select("id").eq("company_id", companyId).maybeSingle();
    if (!sub) {
      const today = new Date();
      const end = new Date(today.getTime() + 180 * 86400000);
      await db.from("company_subscriptions").insert({
        company_id: companyId,
        plan: "demonstration",
        status: "active",
        is_demo: true,
        payment_status: "demo",
        price_sar: null,
        billing_period: null,
        starts_on: today.toISOString().slice(0, 10),
        expires_on: end.toISOString().slice(0, 10),
        assessment_credits: 100,
        commercial_notes: "Controlled demonstration workspace. No commercial agreement or payment on record.",
      });
    }

    // Fictional demo employee identities (clearly labelled), approved through the access-request trail.
    for (const role of ["company_admin", "recruiter", "interviewer"] as const) {
      const local = `${role === "company_admin" ? "admin" : role}.${SHORT[reg]}`;
      const email = `${local}@jadarah-demo.test`;
      let uid = userByEmail.get(email);
      if (!uid) {
        const { data, error } = await db.auth.admin.createUser({
          email,
          password: demoPassword,
          email_confirm: true,
          user_metadata: { full_name: `Demo ${ROLE_LABEL[role]} · ${e.name_en.replace(/\s*\(.*\)$/, "")}`, account_type: "company", locale: "ar" },
        });
        if (error) throw error;
        uid = data.user.id;
      }
      await db.from("profiles").update({ is_demo: true, onboarding_completed: true }).eq("id", uid);
      const { data: mem } = await db.from("company_memberships").select("id").eq("company_id", companyId).eq("user_id", uid).maybeSingle();
      if (!mem) {
        await db.from("company_memberships").insert({ company_id: companyId, user_id: uid, role, status: "active" });
        await db.from("company_access_requests").insert({
          user_id: uid,
          company_id: companyId,
          job_title: `Demo ${ROLE_LABEL[role]}`,
          requested_role: role,
          granted_role: role,
          status: "approved",
          decision_note: "Provisioned demonstration identity (fictional).",
          reviewed_at: new Date().toISOString(),
        });
      }
    }

    // Simulation opportunities (idempotent by company + title).
    let jobs = 0;
    for (const j of meta.jobs) {
      const { data: existing } = await db.from("jobs").select("id").eq("company_id", companyId).eq("title_en", j.title_en).maybeSingle();
      const jobRow = {
        company_id: companyId,
        title_en: j.title_en,
        title_ar: j.title_ar,
        description_en: j.description_en,
        description_ar: j.description_ar,
        responsibilities_en: j.responsibilities_en,
        responsibilities_ar: j.responsibilities_ar,
        qualifications_en: j.qualifications_en,
        qualifications_ar: j.qualifications_ar,
        experience_level: j.level,
        min_years: j.min_years,
        city: meta.city,
        work_mode: j.work_mode,
        employment_type: "full_time" as const,
        category_id: catId.get(j.category) ?? null,
        listing_type: "simulation" as const,
        status: "published" as const,
        published_at: new Date().toISOString(),
      };
      let jobId = existing?.id;
      if (jobId) await db.from("jobs").update(jobRow).eq("id", jobId);
      else {
        const { data, error } = await db.from("jobs").insert(jobRow).select("id").single();
        if (error) throw error;
        jobId = data.id;
      }
      await db.from("job_skills").delete().eq("job_id", jobId);
      const js = j.skills
        .filter(([slug]) => skillId.has(slug))
        .map(([slug, importance, min_level]) => ({ job_id: jobId!, skill_id: skillId.get(slug)!, importance, min_level }));
      const missing = j.skills.filter(([slug]) => !skillId.has(slug)).map(([s]) => s);
      if (missing.length) console.log(`  ! ${reg} ${j.title_en}: unknown skills ${missing.join(", ")}`);
      if (js.length) {
        const { error } = await db.from("job_skills").insert(js);
        if (error) throw error;
      }
      jobs++;
    }
    summary.push(`${reg} ${e.name_en}: ${found ? "updated" : "created"} · ${jobs} simulation jobs`);
  }
  console.log(summary.join("\n"));
})().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : JSON.stringify(e));
  process.exit(1);
});
