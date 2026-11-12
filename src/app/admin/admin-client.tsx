"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import {
  addResource,
  generateReport,
  getCompanyDocumentUrl,
  resetDemo,
  reviewCompany,
  saveSetting,
  setMembership,
  setPlatformRole,
  setUserStatus,
  toggleResource,
  verifyResourceLink,
} from "@/features/admin/actions";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

function useResult(state: ActionResult | null) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      if (state.message) toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);
}

export function ReviewForm({ companyId, status }: { companyId: string; status: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    reviewCompany.bind(null, companyId),
    null,
  );
  useResult(state);
  const options =
    status === "approved"
      ? [["suspend", L("Suspend", "تعليق")]]
      : status === "suspended"
        ? [["reactivate", L("Reactivate", "إعادة التفعيل")]]
        : [
            ["approve", L("Approve", "اعتماد")],
            ["request_info", L("Request more documents", "طلب مستندات إضافية")],
            ["reject", L("Reject", "رفض")],
          ];
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label={L("Decision", "القرار")} htmlFor="decision">
        <Select id="decision" name="decision" defaultValue={options[0][0]}>
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label={L(
          "Notes to the company (required except for approval)",
          "ملاحظات للشركة (مطلوبة عدا الاعتماد)",
        )}
        htmlFor="notes"
      >
        <Textarea id="notes" name="notes" rows={3} maxLength={1000} />
      </Field>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" loading={pending}>
        {L("Record decision", "تسجيل القرار")}
      </Button>
    </form>
  );
}

export function DocLink({ path }: { path: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const r = await getCompanyDocumentUrl(path);
        setBusy(false);
        if (r.ok) window.open(r.data!.url, "_blank", "noopener");
        else toast.error(r.error);
      }}
    >
      <FileText /> {path.split("/").pop()?.slice(37)}
    </Button>
  );
}

export function UserControls({
  userId,
  status,
  isAdmin,
  self,
}: {
  userId: string;
  status: string;
  isAdmin: boolean;
  self: boolean;
}) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (p: Promise<ActionResult>) =>
    start(async () => {
      const r = await p;
      if (r.ok) router.refresh();
      else toast.error(r.error);
    });
  if (self) return <span className="text-subtle text-xs">{L("Your account", "حسابك")}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {status === "active" ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            confirm(L("Suspend this user?", "تعليق هذا المستخدم؟")) && run(setUserStatus(userId, "suspended"))
          }
        >
          {L("Suspend", "تعليق")}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="soft"
          disabled={pending}
          onClick={() => run(setUserStatus(userId, "active"))}
        >
          {L("Reactivate", "إعادة التفعيل")}
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          confirm(
            isAdmin
              ? L("Revoke Super Admin?", "إلغاء صلاحية مدير المنصة؟")
              : L(
                  "Grant Super Admin? This gives full platform control",
                  "منح صلاحية مدير المنصة؟ هذا يمنح تحكمًا كاملًا",
                ),
          ) && run(setPlatformRole(userId, "super_admin", !isAdmin))
        }
      >
        {isAdmin ? L("Revoke admin", "إلغاء الإدارة") : L("Make admin", "تعيين مديرًا")}
      </Button>
    </div>
  );
}

export function MembershipForm({
  userId,
  companies,
}: {
  userId: string;
  companies: { id: string; name: string }[];
}) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(setMembership, null);
  useResult(state);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
      <input type="hidden" name="user_id" value={userId} />
      <Select name="company_id" aria-label={L("Company", "الشركة")}>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select name="role" aria-label={L("Role", "الدور")} defaultValue="company_admin">
        {(["company_admin", "recruiter", "interviewer"] as const).map((r) => (
          <option key={r} value={r}>
            {t.roles[r]}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" loading={pending}>
        {L("Assign", "تعيين")}
      </Button>
      {state && !state.ok && (
        <div className="sm:col-span-3">
          <FormMessage>{state.error}</FormMessage>
        </div>
      )}
    </form>
  );
}

export function ResourceForm() {
  const { locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addResource, null);
  useResult(state);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Slug" htmlFor="r-slug" required>
        <Input id="r-slug" name="slug" dir="ltr" pattern="[a-z0-9-]{3,60}" required />
      </Field>
      <Field label={L("Provider", "الجهة")} htmlFor="r-prov" required>
        <Input id="r-prov" name="provider" required />
      </Field>
      <Field label={L("Title (EN)", "العنوان (EN)")} htmlFor="r-en" required>
        <Input id="r-en" name="title_en" dir="ltr" required />
      </Field>
      <Field label={L("Title (AR)", "العنوان (AR)")} htmlFor="r-ar" required>
        <Input id="r-ar" name="title_ar" dir="rtl" required />
      </Field>
      <Field label="URL (https)" htmlFor="r-url" required className="sm:col-span-2">
        <Input id="r-url" name="url" type="url" dir="ltr" required />
      </Field>
      <Field label={L("Type", "النوع")} htmlFor="r-kind">
        <Select id="r-kind" name="kind">
          {["course", "documentation", "video", "book", "practice", "article"].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </Select>
      </Field>
      <Field label={L("Level", "المستوى")} htmlFor="r-lvl">
        <Select id="r-lvl" name="level">
          {["beginner", "intermediate", "advanced"].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </Select>
      </Field>
      <Field label={L("Topic", "الموضوع")} htmlFor="r-topic" required>
        <Input id="r-topic" name="topic" required />
      </Field>
      <Field label={L("Skill slugs (comma separated)", "معرّفات المهارات (بفواصل)")} htmlFor="r-sk">
        <Input id="r-sk" name="skill_slugs" dir="ltr" />
      </Field>
      {state && !state.ok && (
        <div className="sm:col-span-2">
          <FormMessage>{state.error}</FormMessage>
        </div>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>
          {L("Add resource", "إضافة مصدر")}
        </Button>
      </div>
    </form>
  );
}

export function ResourceRowActions({ id, active }: { id: string; active: boolean }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await verifyResourceLink(id);
            if (r.ok)
              toast[r.data!.status >= 200 && r.data!.status < 400 ? "success" : "error"](
                `HTTP ${r.data!.status || "error"}`,
              );
            router.refresh();
          })
        }
      >
        <Link2 /> {L("Check link", "فحص الرابط")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await toggleResource(id, !active);
            router.refresh();
          })
        }
      >
        {active ? L("Deactivate", "تعطيل") : L("Activate", "تفعيل")}
      </Button>
    </div>
  );
}

export function SettingForm({
  k,
  value,
  description,
}: {
  k?: string;
  value?: string;
  description?: string | null;
}) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveSetting, null);
  useResult(state);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-start">
      <Input
        name="key"
        defaultValue={k}
        readOnly={!!k}
        placeholder="key.name"
        dir="ltr"
        aria-label={L("Key", "المفتاح")}
      />
      <div className="flex flex-col gap-1">
        <Input name="value" defaultValue={value} dir="ltr" aria-label={L("JSON value", "قيمة JSON")} />
        {description && <p className="text-subtle text-xs">{description}</p>}
        <input type="hidden" name="description" value={description ?? ""} />
      </div>
      <Button type="submit" size="sm" loading={pending}>
        {t.common.save}
      </Button>
      {state && !state.ok && (
        <div className="sm:col-span-3">
          <FormMessage>{state.error}</FormMessage>
        </div>
      )}
    </form>
  );
}

export function ReportButton() {
  const { locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await generateReport("platform_snapshot");
          if (r.ok) router.refresh();
          else toast.error(r.error);
        })
      }
    >
      {L("Generate snapshot", "إنشاء لقطة")}
    </Button>
  );
}

export function DemoResetForm() {
  const { locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(resetDemo, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label={L("Type RESET DEMO to confirm", "اكتب RESET DEMO للتأكيد")} htmlFor="confirm">
        <Input id="confirm" name="confirm" dir="ltr" autoComplete="off" />
      </Field>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      {state?.ok && <FormMessage tone="success">{state.message}</FormMessage>}
      <Button type="submit" variant="danger" loading={pending}>
        {L("Remove all demo data", "حذف كل البيانات التجريبية")}
      </Button>
    </form>
  );
}
