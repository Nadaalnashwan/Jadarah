/**
 * Bilingual email templates (Arabic + English in every message; the recipient's language first).
 * Pure functions: no I/O, no secrets. Brand colours from the approved identity boards.
 */
export type Locale = "ar" | "en";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const NAVY = "#172F49";
const BLUE = "#3B66F6";
const IVORY = "#E9DCD2";
const PAGE = "#D4E4EF";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Only same-site relative links or https URLs on the site's own origin are rendered as buttons. */
export function absoluteLink(siteUrl: string, link: string | null | undefined): string | null {
  if (!link) return null;
  const base = siteUrl.replace(/\/+$/, "");
  if (link.startsWith("/") && !link.startsWith("//")) return base + link;
  try {
    const u = new URL(link);
    return u.origin === new URL(base).origin ? u.toString() : null;
  } catch {
    return null;
  }
}

interface Block {
  locale: Locale;
  heading: string;
  body: string[];
  cta?: { label: string; url: string };
  footnote?: string;
}

function htmlBlock(b: Block): string {
  const dir = b.locale === "ar" ? "rtl" : "ltr";
  const font = b.locale === "ar" ? "'IBM Plex Sans Arabic', Tahoma, Arial, sans-serif" : "Manrope, 'Segoe UI', Arial, sans-serif";
  const align = b.locale === "ar" ? "right" : "left";
  return `<div dir="${dir}" lang="${b.locale}" style="text-align:${align};font-family:${font};color:${NAVY};padding:24px 28px">
  <h1 style="margin:0 0 12px;font-size:20px;line-height:1.4">${escapeHtml(b.heading)}</h1>
  ${b.body.map((p) => `<p style="margin:0 0 10px;font-size:15px;line-height:1.7">${escapeHtml(p)}</p>`).join("\n  ")}
  ${
    b.cta
      ? `<p style="margin:18px 0 6px"><a href="${escapeHtml(b.cta.url)}" style="display:inline-block;background:${BLUE};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px">${escapeHtml(b.cta.label)}</a></p>`
      : ""
  }
  ${b.footnote ? `<p style="margin:14px 0 0;font-size:12px;color:#235F76;line-height:1.6">${escapeHtml(b.footnote)}</p>` : ""}
</div>`;
}

function textBlock(b: Block): string {
  return [b.heading, "", ...b.body, ...(b.cta ? ["", `${b.cta.label}: ${b.cta.url}`] : []), ...(b.footnote ? ["", b.footnote] : [])].join("\n");
}

function layout(first: Block, second: Block): { html: string; text: string } {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"></head>
<body style="margin:0;background:${PAGE};padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #C1D9EA">
<tr><td style="background:${NAVY};padding:18px 28px;color:${IVORY};font-family:Manrope,Arial,sans-serif;font-weight:800;letter-spacing:.08em">جَدارة · JADARAH</td></tr>
<tr><td>${htmlBlock(first)}</td></tr>
<tr><td style="padding:0 28px"><hr style="border:none;border-top:1px solid #C1D9EA;margin:0"></td></tr>
<tr><td>${htmlBlock(second)}</td></tr>
<tr><td style="background:${PAGE};padding:14px 28px;font-family:Arial,sans-serif;font-size:11px;color:#235F76;text-align:center">من المهارة إلى الفرصة. · From skill to opportunity.</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${textBlock(first)}\n\n— — —\n\n${textBlock(second)}\n\nJADARAH | جدارة`;
  return { html, text };
}

function ordered<T extends { locale: Locale }>(locale: Locale, ar: T, en: T): [T, T] {
  return locale === "ar" ? [ar, en] : [en, ar];
}

// ---------------------------------------------------------------- notification (generic)
export interface NotificationPayload {
  kind?: string;
  title_en: string;
  title_ar: string;
  body_en?: string | null;
  body_ar?: string | null;
  link?: string | null;
}

export function renderNotification(locale: Locale, p: NotificationPayload, siteUrl: string): RenderedEmail {
  const url = absoluteLink(siteUrl, p.link);
  const ar: Block = {
    locale: "ar",
    heading: p.title_ar,
    body: [p.body_ar ?? ""].filter(Boolean),
    cta: url ? { label: "افتح في جدارة", url } : undefined,
    footnote: "يمكنك تعديل تفضيلات البريد من الإعدادات في حسابك.",
  };
  const en: Block = {
    locale: "en",
    heading: p.title_en,
    body: [p.body_en ?? ""].filter(Boolean),
    cta: url ? { label: "Open in JADARAH", url } : undefined,
    footnote: "You can change email preferences in your account settings.",
  };
  const [a, b] = ordered(locale, ar, en);
  return { subject: locale === "ar" ? `${p.title_ar} · جدارة` : `${p.title_en} · JADARAH`, ...layout(a, b) };
}

// ---------------------------------------------------------------- company invitation
export interface InvitationPayload {
  company_en: string;
  company_ar: string;
  role: string;
  token: string;
  expires_at: string;
  inviter?: string;
}

const ROLE: Record<string, [string, string]> = {
  company_admin: ["Company admin", "مدير الشركة"],
  recruiter: ["Recruiter", "مسؤول توظيف"],
  interviewer: ["Interviewer", "مُقابِل"],
};

export function invitationUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/invitations/accept?token=${encodeURIComponent(token)}`;
}

function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", {
    dateStyle: "long",
    timeZone: "Asia/Riyadh",
  }).format(d);
}

export function renderInvitation(locale: Locale, p: InvitationPayload, siteUrl: string): RenderedEmail {
  const url = invitationUrl(siteUrl, p.token);
  const [roleEn, roleAr] = ROLE[p.role] ?? [p.role, p.role];
  const ar: Block = {
    locale: "ar",
    heading: `دعوة للانضمام إلى فريق ${p.company_ar} على جدارة`,
    body: [
      `${p.inviter ? `دعاك ${p.inviter}` : "تمت دعوتك"} للانضمام بدور «${roleAr}».`,
      "سجّل الدخول أو أنشئ حسابًا بنفس عنوان البريد الذي وصلتك عليه هذه الرسالة، ثم اقبل الدعوة.",
    ],
    cta: { label: "عرض الدعوة", url },
    footnote: `تنتهي صلاحية الدعوة في ${formatDate(p.expires_at, "ar")}. إن لم تكن تتوقع هذه الرسالة فتجاهلها.`,
  };
  const en: Block = {
    locale: "en",
    heading: `Join the ${p.company_en} team on JADARAH`,
    body: [
      `${p.inviter ? `${p.inviter} invited you` : "You were invited"} to join as ${roleEn}.`,
      "Sign in or create an account with the same email address this message was sent to, then accept the invitation.",
    ],
    cta: { label: "View invitation", url },
    footnote: `The invitation expires on ${formatDate(p.expires_at, "en")}. If you weren't expecting it, you can ignore this email.`,
  };
  const [a, b] = ordered(locale, ar, en);
  return {
    subject: locale === "ar" ? `دعوة للانضمام إلى ${p.company_ar} · جدارة` : `Invitation to join ${p.company_en} · JADARAH`,
    ...layout(a, b),
  };
}

export function renderEmail(template: string, locale: Locale, payload: unknown, siteUrl: string): RenderedEmail | null {
  if (template === "company_invitation") return renderInvitation(locale, payload as InvitationPayload, siteUrl);
  if (template === "notification") return renderNotification(locale, payload as NotificationPayload, siteUrl);
  return null;
}
