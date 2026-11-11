/**
 * Idempotent initial Super Admin provisioning via the Supabase Auth Admin API.
 *
 *   INITIAL_ADMIN_EMAIL=... INITIAL_ADMIN_PASSWORD=... SUPABASE_SERVICE_ROLE_KEY=... npm run admin:provision
 *
 * - Creates (or finds) a real Auth identity with a confirmed email.
 * - Links the profile, removes the default candidate role and grants super_admin.
 * - Never prints the password; never runs in the browser; the service-role key stays server-side.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.INITIAL_ADMIN_PASSWORD;

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function main() {
  if (!url || !serviceKey)
    fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (server-side only).");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("INITIAL_ADMIN_EMAIL is missing or invalid.");
  if (!password || password.length < 12 || !/\d/.test(password) || !/[A-Za-z]/.test(password))
    fail("INITIAL_ADMIN_PASSWORD must be ≥12 characters with letters and numbers.");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // find existing user by email (paginate)
  let userId: string | null = null;
  for (let page = 1; page < 50 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listUsers failed: ${error.message}`);
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (data.users.length < 200) break;
  }

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Platform Administrator", account_type: "candidate", locale: "ar" },
    });
    if (error || !data.user) fail(`createUser failed: ${error?.message}`);
    userId = data.user.id;
    console.log(`✓ Auth identity created for ${email}`);
  } else {
    const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    if (error) fail(`updateUserById failed: ${error.message}`);
    console.log(`✓ Existing identity found for ${email} (password unchanged)`);
  }

  const { error: pErr } = await admin
    .from("profiles")
    .update({ account_type: "admin", onboarding_completed: true, status: "active" })
    .eq("id", userId);
  if (pErr) fail(`profile update failed: ${pErr.message}`);
  await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "candidate");
  const { error: rErr } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "super_admin" }, { onConflict: "user_id,role" });
  if (rErr) fail(`role grant failed: ${rErr.message}`);
  await admin
    .from("audit_logs")
    .insert({
      actor_id: null,
      action: "admin.provisioned",
      entity_type: "user",
      entity_id: userId,
      metadata: { source: "scripts/provision-admin.ts" },
    });
  console.log(
    "✓ Super Admin role granted. Enable MFA for this account in Supabase (Auth → MFA) where available.",
  );
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
