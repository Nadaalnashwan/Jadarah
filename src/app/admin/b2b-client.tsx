"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import {
  provisionCompany,
  recordPayment,
  reviewAccessRequest,
  saveBrandProfile,
  saveSubscription,
} from "@/features/admin/b2b-actions";
import type { ActionResult } from "@/lib/errors";
import { useI18n } from "@/lib/i18n/client";
import { tx } from "@/lib/i18n/config";

function useToast(state: ActionResult | null, reset?: () => void) {
  const router = useRouter();
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      reset?.();
      router.refresh();
    } else toast.error(state.error);
  }, [state, router, reset]);
}

export function AccessRequestActions({ id, requestedRole }: { id: string; requestedRole: string }) {
  const { t, locale } = useI18n();
  const L = tx(locale);
  const router = useRouter();
  const [role, setRole] = useState(requestedRole);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const go = (decision: "approve" | "reject") =>
    start(async () => {
      const r = await reviewAccessRequest(id, { decision, role, note });
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else toast.error(r.error);
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label={L("Role", "الدور")} className="h-9 w-auto text-sm">
        <option value="recruiter">{t.roles.recruiter}</option>
        <option value="interviewer">{t.roles.interviewer}</option>
        <option value="company_admin">{t.roles.company_admin}</option>
      </Select>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={L("Note", "ملاحظة")} className="h-9 w-40 text-sm" aria-label={L("Note", "ملاحظة")} />
      <Button size="sm" loading={pending} onClick={() => go("approve")}>
        <Check /> {L("Approve", "موافقة")}
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => go("reject")}>
        <X /> {L("Reject", "رفض")}
      </Button>
    </div>
  );
}

export function ProvisionForm() {
  const { locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState(provisionCompany, null);
  useToast(state);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label={L("Name (English)", "الاسم (إنجليزي)")} htmlFor="pv-en" required>
        <Input id="pv-en" name="name_en" required dir="ltr" />
      </Field>
      <Field label={L("Name (Arabic)", "الاسم (عربي)")} htmlFor="pv-ar" required>
        <Input id="pv-ar" name="name_ar" required dir="rtl" />
      </Field>
      <Field label={L("Sector (English)", "القطاع (إنجليزي)")} htmlFor="pv-se">
        <Input id="pv-se" name="sector_en" />
      </Field>
      <Field label={L("Sector (Arabic)", "القطاع (عربي)")} htmlFor="pv-sa">
        <Input id="pv-sa" name="sector_ar" dir="rtl" />
      </Field>
      <Field label={L("Website", "الموقع")} htmlFor="pv-web">
        <Input id="pv-web" name="website" type="url" dir="ltr" placeholder="https://" />
      </Field>
      <Field label={L("Registry ID", "المعرّف")} htmlFor="pv-reg">
        <Input id="pv-reg" name="registry_id" dir="ltr" />
      </Field>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>
          {L("Provision organization", "تهيئة الجهة")}
        </Button>
      </div>
    </form>
  );
}

type Sub = {
  plan: string;
  status: string;
  price_sar: number | null;
  billing_period: string | null;
  starts_on: string | null;
  expires_on: string | null;
  assessment_credits: number | null;
  payment_status: string;
  is_demo: boolean;
  commercial_notes: string | null;
};

export function SubscriptionForm({ companyId, sub, listed, acceptsRequests }: { companyId: string; sub: Sub | null; listed: boolean; acceptsRequests: boolean }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState(saveSubscription.bind(null, companyId), null);
  useToast(state);
  const [demo, setDemo] = useState(sub?.is_demo ?? false);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <Field label={L("Plan", "الخطة")} htmlFor="s-plan">
        <Input id="s-plan" name="plan" defaultValue={sub?.plan ?? "standard"} />
      </Field>
      <Field label={L("Status", "الحالة")} htmlFor="s-status">
        <Select id="s-status" name="status" defaultValue={sub?.status ?? "pending"}>
          {["pending", "active", "suspended", "expired", "cancelled"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </Field>
      <Field label={L("Payment status", "حالة الدفع")} htmlFor="s-pay">
        <Select id="s-pay" name="payment_status" defaultValue={sub?.payment_status ?? "not_invoiced"} key={String(demo)}>
          {(demo ? ["demo"] : ["not_invoiced", "invoiced", "partially_paid", "paid", "waived"]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </Field>
      <Field label={L("Contract value (SAR)", "قيمة العقد (ريال)")} htmlFor="s-price">
        <Input id="s-price" name="price_sar" type="number" min={0} step="0.01" defaultValue={sub?.price_sar ?? ""} disabled={demo} className="ltr-nums" />
      </Field>
      <Field label={L("Billing period", "دورة الفوترة")} htmlFor="s-period">
        <Select id="s-period" name="billing_period" defaultValue={sub?.billing_period ?? ""}>
          <option value="">—</option>
          {["monthly", "quarterly", "annual", "one_time", "custom"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </Field>
      <Field label={L("Assessment credits", "رصيد التقييمات")} htmlFor="s-cred" hint={L("Empty = unlimited", "فارغ = غير محدود")}>
        <Input id="s-cred" name="assessment_credits" type="number" min={0} defaultValue={sub?.assessment_credits ?? ""} className="ltr-nums" />
      </Field>
      <Field label={L("Starts", "يبدأ")} htmlFor="s-start">
        <Input id="s-start" name="starts_on" type="date" defaultValue={sub?.starts_on ?? ""} />
      </Field>
      <Field label={L("Expires", "ينتهي")} htmlFor="s-end">
        <Input id="s-end" name="expires_on" type="date" defaultValue={sub?.expires_on ?? ""} />
      </Field>
      <div className="flex flex-col justify-end gap-2 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox name="is_demo" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> {L("Demonstration access", "وصول تجريبي")}
        </label>
        <label className="flex items-center gap-2">
          <Checkbox name="listed" defaultChecked={listed} /> {L("Listed in catalogue", "ظاهرة في الدليل")}
        </label>
        <label className="flex items-center gap-2">
          <Checkbox name="accepts_access_requests" defaultChecked={acceptsRequests} /> {L("Accepts access requests", "تستقبل طلبات الانضمام")}
        </label>
      </div>
      <Field label={L("Commercial notes", "ملاحظات تجارية")} htmlFor="s-notes" className="sm:col-span-3">
        <Textarea id="s-notes" name="commercial_notes" rows={2} defaultValue={sub?.commercial_notes ?? ""} />
      </Field>
      {state && !state.ok && (
        <div className="sm:col-span-3">
          <FormMessage>{state.error}</FormMessage>
        </div>
      )}
      <div className="sm:col-span-3">
        <Button type="submit" loading={pending}>{L("Save subscription", "حفظ الاشتراك")}</Button>
      </div>
    </form>
  );
}

export function PaymentForm({ companyId }: { companyId: string }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [key, setKey] = useState(0);
  const [state, action, pending] = useActionState(recordPayment.bind(null, companyId), null);
  useToast(state, () => setKey((k) => k + 1));
  return (
    <form key={key} action={action} className="grid gap-3 sm:grid-cols-5">
      <Select name="kind" defaultValue="payment" aria-label={L("Type", "النوع")}>
        <option value="payment">{L("Payment", "دفعة")}</option>
        <option value="refund">{L("Refund", "استرداد")}</option>
      </Select>
      <Input name="amount_sar" type="number" min={0.01} step="0.01" required placeholder={L("Amount (SAR)", "المبلغ (ريال)")} aria-label={L("Amount", "المبلغ")} className="ltr-nums" />
      <Input name="paid_on" type="date" required aria-label={L("Date", "التاريخ")} />
      <Input name="reference" placeholder={L("Reference", "المرجع")} aria-label={L("Reference", "المرجع")} />
      <Button type="submit" variant="soft" loading={pending}>{L("Record", "تسجيل")}</Button>
    </form>
  );
}

type Brand = {
  primary_hex: string | null;
  secondary_hex: string | null;
  logo_source_url: string | null;
  brand_source: string | null;
  identity_status: string;
  usage_permission: string;
  notes: string | null;
};
export function BrandForm({ companyId, brand }: { companyId: string; brand: Brand | null }) {
  const { locale } = useI18n();
  const L = tx(locale);
  const [state, action, pending] = useActionState(saveBrandProfile.bind(null, companyId), null);
  useToast(state);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <Field label={L("Identity", "الهوية")} htmlFor="b-id">
        <Select id="b-id" name="identity_status" defaultValue={brand?.identity_status ?? "not_verified"}>
          <option value="not_verified">not_verified</option>
          <option value="verified">verified</option>
        </Select>
      </Field>
      <Field label={L("Usage permission", "إذن الاستخدام")} htmlFor="b-perm">
        <Select id="b-perm" name="usage_permission" defaultValue={brand?.usage_permission ?? "not_verified"}>
          <option value="not_verified">not_verified</option>
          <option value="granted">granted</option>
          <option value="denied">denied</option>
        </Select>
      </Field>
      <Field label={L("Source", "المصدر")} htmlFor="b-src">
        <Input id="b-src" name="brand_source" dir="ltr" defaultValue={brand?.brand_source ?? ""} />
      </Field>
      <Field label={L("Primary colour", "اللون الأساسي")} htmlFor="b-p">
        <Input id="b-p" name="primary_hex" dir="ltr" placeholder="#RRGGBB" defaultValue={brand?.primary_hex ?? ""} />
      </Field>
      <Field label={L("Secondary colour", "اللون الثانوي")} htmlFor="b-s">
        <Input id="b-s" name="secondary_hex" dir="ltr" placeholder="#RRGGBB" defaultValue={brand?.secondary_hex ?? ""} />
      </Field>
      <Field label={L("Logo source URL", "رابط مصدر الشعار")} htmlFor="b-logo">
        <Input id="b-logo" name="logo_source_url" type="url" dir="ltr" defaultValue={brand?.logo_source_url ?? ""} />
      </Field>
      <Field label={L("Notes", "ملاحظات")} htmlFor="b-notes" className="sm:col-span-3">
        <Textarea id="b-notes" name="notes" rows={2} defaultValue={brand?.notes ?? ""} />
      </Field>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <div className="sm:col-span-3">
        <Button type="submit" variant="soft" loading={pending}>{L("Save brand profile", "حفظ الهوية")}</Button>
      </div>
    </form>
  );
}
