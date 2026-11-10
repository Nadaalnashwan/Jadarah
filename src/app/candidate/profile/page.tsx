import { Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, PageHeader, Progress } from "@/components/ui/primitives";
import { deleteProfileItem } from "@/features/candidate/actions";
import { requireCandidate } from "@/lib/auth/session";
import { formatDate, tx } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileCompletion } from "@/services/candidate";
import { AddItemForm, ProfileForm } from "./forms";

type SectionTableName =
  "candidate_education" | "candidate_experience" | "candidate_projects" | "candidate_certifications";
function Section({
  title,
  table,
  items,
  render,
  fields,
  emptyLabel,
  deleteLabel,
}: {
  title: string;
  table: SectionTableName;
  items: { id: string }[];
  render: (i: never) => React.ReactNode;
  fields: Parameters<typeof AddItemForm>[0]["fields"];
  emptyLabel: string;
  deleteLabel: string;
}) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody className="flex flex-col gap-3">
        {items.length === 0 && <p className="text-subtle text-sm">{emptyLabel}</p>}
        <ul className="flex flex-col gap-2">
          {items.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0 text-sm">{render(i as never)}</div>
              <form action={deleteProfileItem.bind(null, table, i.id)}>
                <button
                  className="text-subtle hover:bg-danger-soft hover:text-danger flex size-8 items-center justify-center rounded-full"
                  aria-label={deleteLabel}
                >
                  <Trash2 className="size-4" />
                </button>
              </form>
            </li>
          ))}
        </ul>
        <AddItemForm table={table} fields={fields} />
      </CardBody>
    </Card>
  );
}

export default async function ProfilePage() {
  const session = await requireCandidate();
  const { t, locale } = await getI18n();
  const L = tx(locale);
  const supabase = await createClient();
  const uid = session.userId;
  const [{ data: cp }, { data: edu }, { data: exp }, { data: projects }, { data: certs }, completion] =
    await Promise.all([
      supabase.from("candidate_profiles").select("*").eq("user_id", uid).maybeSingle(),
      supabase
        .from("candidate_education")
        .select("*")
        .eq("candidate_id", uid)
        .order("end_date", { ascending: false, nullsFirst: true }),
      supabase
        .from("candidate_experience")
        .select("*")
        .eq("candidate_id", uid)
        .order("start_date", { ascending: false }),
      supabase
        .from("candidate_projects")
        .select("*")
        .eq("candidate_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("candidate_certifications")
        .select("*")
        .eq("candidate_id", uid)
        .order("issue_date", { ascending: false, nullsFirst: true }),
      getProfileCompletion(supabase, uid, session.profile.full_name),
    ]);
  const languages = Array.isArray(cp?.languages)
    ? (cp!.languages as { name: string }[]).map((l) => l.name).join(", ")
    : "";

  return (
    <>
      <PageHeader
        eyebrow={t.candidate.nav.profile}
        title={L("Your professional profile", "ملفك المهني")}
        description={L(
          "Save anytime — incomplete profiles are kept and you can continue later.",
          "احفظ في أي وقت — يُحتفظ بالملف غير المكتمل ويمكنك المتابعة لاحقًا.",
        )}
      />
      <div className="surface-card mb-6 p-5">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>{t.candidate.profileCompletion}</span>
          <span className="ltr-nums">{completion}%</span>
        </div>
        <Progress value={completion} className="mt-2" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="xl:row-span-2">
          <CardHeader title={L("Basics", "المعلومات الأساسية")} />
          <CardBody>
            <ProfileForm
              defaults={{
                full_name: session.profile.full_name,
                phone: session.profile.phone ?? "",
                headline: cp?.headline ?? "",
                summary: cp?.summary ?? "",
                city: cp?.city ?? "",
                years_experience: cp?.years_experience ?? 0,
                experience_level: cp?.experience_level ?? "entry",
                career_interests: (cp?.career_interests ?? []).join(", "),
                languages,
                linkedin_url: cp?.linkedin_url ?? "",
                portfolio_url: cp?.portfolio_url ?? "",
                visibility: cp?.visibility ?? "companies",
              }}
            />
          </CardBody>
        </Card>
        <Section
          emptyLabel={L("Nothing added yet.", "لم يُضف شيء بعد.")}
          deleteLabel={t.common.delete}
          title={L("Experience", "الخبرة")}
          table="candidate_experience"
          items={exp ?? []}
          render={(i: {
            title: string;
            company: string;
            start_date: string;
            end_date: string | null;
            is_current: boolean;
            description: string | null;
          }) => (
            <>
              <p className="font-semibold">
                {i.title} · {i.company}
              </p>
              <p className="text-subtle text-xs">
                {formatDate(i.start_date, locale)} –{" "}
                {i.is_current ? L("Present", "حتى الآن") : formatDate(i.end_date, locale)}
              </p>
              {i.description && <p className="text-muted mt-1">{i.description}</p>}
            </>
          )}
          fields={[
            { name: "title", label: L("Title", "المسمى"), required: true },
            { name: "company", label: L("Company", "الشركة"), required: true },
            { name: "location", label: L("Location", "الموقع") },
            { name: "start_date", label: L("Start date", "تاريخ البدء"), type: "date", required: true },
            { name: "end_date", label: L("End date", "تاريخ الانتهاء"), type: "date" },
            { name: "is_current", label: L("I currently work here", "أعمل هنا حاليًا"), type: "checkbox" },
            { name: "description", label: L("What you did", "ما أنجزته"), type: "textarea" },
          ]}
        />
        <Section
          emptyLabel={L("Nothing added yet.", "لم يُضف شيء بعد.")}
          deleteLabel={t.common.delete}
          title={L("Education", "التعليم")}
          table="candidate_education"
          items={edu ?? []}
          render={(i: {
            degree: string;
            institution: string;
            end_date: string | null;
            grade: string | null;
          }) => (
            <>
              <p className="font-semibold">{i.degree}</p>
              <p className="text-subtle text-xs">
                {i.institution} · {formatDate(i.end_date, locale, { year: "numeric" })}
                {i.grade ? ` · ${i.grade}` : ""}
              </p>
            </>
          )}
          fields={[
            { name: "institution", label: L("Institution", "المؤسسة"), required: true },
            { name: "degree", label: L("Degree", "الدرجة"), required: true },
            { name: "field", label: L("Field", "التخصص") },
            { name: "start_date", label: L("Start", "البداية"), type: "date" },
            { name: "end_date", label: L("End", "النهاية"), type: "date" },
            { name: "grade", label: L("Grade", "التقدير") },
          ]}
        />
        <Section
          emptyLabel={L("Nothing added yet.", "لم يُضف شيء بعد.")}
          deleteLabel={t.common.delete}
          title={L("Projects", "المشاريع")}
          table="candidate_projects"
          items={projects ?? []}
          render={(i: { title: string; description: string | null; url: string | null }) => (
            <>
              <p className="font-semibold">{i.title}</p>
              {i.description && <p className="text-muted">{i.description}</p>}
              {i.url && (
                <a
                  href={i.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary dark:text-lavender text-xs"
                  dir="ltr"
                >
                  {i.url}
                </a>
              )}
            </>
          )}
          fields={[
            { name: "title", label: L("Title", "العنوان"), required: true },
            { name: "description", label: L("Description", "الوصف"), type: "textarea" },
            { name: "url", label: L("Link", "الرابط"), type: "url" },
          ]}
        />
        <Section
          emptyLabel={L("Nothing added yet.", "لم يُضف شيء بعد.")}
          deleteLabel={t.common.delete}
          title={L("Certifications", "الشهادات")}
          table="candidate_certifications"
          items={certs ?? []}
          render={(i: { name: string; issuer: string | null; issue_date: string | null }) => (
            <>
              <p className="font-semibold">{i.name}</p>
              <p className="text-subtle text-xs">
                {i.issuer ?? ""} {i.issue_date ? `· ${formatDate(i.issue_date, locale)}` : ""}
              </p>
            </>
          )}
          fields={[
            { name: "name", label: L("Name", "الاسم"), required: true },
            { name: "issuer", label: L("Issuer", "الجهة المانحة") },
            { name: "issue_date", label: L("Issue date", "تاريخ الإصدار"), type: "date" },
            { name: "credential_url", label: L("Credential link", "رابط التحقق"), type: "url" },
          ]}
        />
      </div>
    </>
  );
}
