import type { Locale } from "./i18n/config";

/** Business-rule messages raised by our RPCs, localized. Unknown errors map to a generic message (no internals leak). */
const KNOWN: [RegExp, string, string][] = [
  [
    /already been given to candidates/i,
    "Candidates have already received this practical task, so its content is locked. Duplicate it to make changes.",
    "استلم مرشحون هذه المهمة العملية، لذا أصبح محتواها ثابتًا. أنشئ نسخة منها لإجراء تعديلات.",
  ],
  [
    /practical task; it cannot be replaced/i,
    "Candidates have already received this job's practical task, so it can't be replaced.",
    "استلم مرشحون المهمة العملية لهذه الوظيفة، لذا لا يمكن استبدالها.",
  ],
  [
    /publish the practical task before publishing the job/i,
    "Publish the practical task before publishing the job.",
    "انشر المهمة العملية أولًا قبل نشر الوظيفة.",
  ],
  [
    /practical task (is archived|is not available|belongs to another organization|not found)/i,
    "That practical task can't be attached to this job.",
    "لا يمكن ربط هذه المهمة العملية بهذه الوظيفة.",
  ],
  [/this application is closed/i, "This application is closed.", "هذا الطلب مغلق."],
  [
    /assessment credits exhausted/i,
    "This job can't receive applications right now. Please try again later.",
    "لا تستقبل هذه الوظيفة طلبات حاليًا. حاول لاحقًا.",
  ],
  [
    /shortlisted before an interview/i,
    "The candidate must be shortlisted before an interview can be created.",
    "يجب إضافة المرشح إلى القائمة المختصرة قبل إنشاء مقابلة.",
  ],
  [
    /invalid (application )?status transition/i,
    "That status change isn't allowed from the current stage.",
    "لا يُسمح بتغيير الحالة هذا من المرحلة الحالية.",
  ],
  [
    /set automatically by its workflow/i,
    "This status is set automatically by its workflow.",
    "تُضبط هذه الحالة تلقائيًا عبر مسار العمل الخاص بها.",
  ],
  [/already applied/i, "You have already applied to this job.", "لقد تقدّمت لهذه الوظيفة مسبقًا."],
  [
    /not accepting applications/i,
    "This job is not accepting applications.",
    "هذه الوظيفة لا تستقبل طلبات حاليًا.",
  ],
  [/deadline has passed/i, "The deadline has passed.", "انتهى الموعد النهائي."],
  [
    /only candidates can apply/i,
    "Only candidate accounts can apply to jobs.",
    "يمكن لحسابات المرشحين فقط التقدّم للوظائف.",
  ],
  [
    /answer all required questions/i,
    "Please answer all required questions.",
    "يُرجى الإجابة عن جميع الأسئلة المطلوبة.",
  ],
  [
    /selected CV was not found/i,
    "The selected CV was not found.",
    "لم يتم العثور على السيرة الذاتية المختارة.",
  ],
  [
    /company must be approved/i,
    "Your company must be approved before publishing jobs.",
    "يجب اعتماد شركتك قبل نشر الوظائف.",
  ],
  [
    /title is required in both languages/i,
    "Add the job title in Arabic and English.",
    "أضف المسمى الوظيفي بالعربية والإنجليزية.",
  ],
  [
    /already belongs to a company/i,
    "This account already belongs to a company.",
    "هذا الحساب مرتبط بشركة بالفعل.",
  ],
  [
    /only company accounts/i,
    "Only company accounts can register a company.",
    "يمكن لحسابات الشركات فقط تسجيل شركة.",
  ],
  [/a reason is required/i, "Please provide a reason.", "يُرجى ذكر السبب."],
  [/not awaiting review/i, "This company is not awaiting review.", "هذه الشركة ليست بانتظار المراجعة."],
  [
    /at least one active admin/i,
    "A company must keep at least one active admin.",
    "يجب أن يبقى للشركة مدير نشط واحد على الأقل.",
  ],
  [
    /cannot change your own account status/i,
    "You can't change your own account status.",
    "لا يمكنك تغيير حالة حسابك بنفسك.",
  ],
  [
    /cannot revoke your own super admin/i,
    "You can't revoke your own Super Admin role.",
    "لا يمكنك إلغاء دور مدير المنصة عن نفسك.",
  ],
  [/time is up/i, "Time is up for this assessment.", "انتهى وقت هذا التقييم."],
  [
    /already (been )?submitted/i,
    "This assessment has already been submitted.",
    "تم تسليم هذا التقييم مسبقًا.",
  ],
  [/assessment is not available/i, "This assessment is not available.", "هذا التقييم غير متاح."],
  [
    /due date must be in the future/i,
    "The due date must be in the future.",
    "يجب أن يكون الموعد النهائي في المستقبل.",
  ],
  [
    /interview time must be in the future/i,
    "The interview time must be in the future.",
    "يجب أن يكون موعد المقابلة في المستقبل.",
  ],
  [/at least one interviewer/i, "Assign at least one interviewer.", "عيّن مُقابِلًا واحدًا على الأقل."],
  [
    /interviewers must be members/i,
    "Interviewers must be members of your company.",
    "يجب أن يكون المُقابِلون أعضاء في شركتك.",
  ],
  [/points must be between/i, "Points are outside the allowed range.", "النقاط خارج النطاق المسموح."],
  [
    /can no longer be withdrawn/i,
    "This application can no longer be withdrawn.",
    "لم يعد بالإمكان سحب هذا الطلب.",
  ],
  [
    /invitation is not valid/i,
    "This invitation is not valid for your account.",
    "هذه الدعوة غير صالحة لحسابك.",
  ],
  [
    /candidate already has an interview/i,
    "The candidate already has an interview at that time. Choose another slot.",
    "لدى المرشح مقابلة أخرى في هذا الوقت. اختر موعدًا آخر.",
  ],
  [
    /interview_participants_no_overlap|23P01|conflicting key value violates exclusion/i,
    "An interviewer is already booked at that time. Pick a free slot.",
    "أحد المُقابِلين محجوز في هذا الوقت. اختر موعدًا متاحًا.",
  ],
  [/interviewer_availability.*exclu|exclusion constraint/i, "Time ranges overlap.", "الفترات الزمنية متداخلة."],
  [/must be in the future/i, "The interview time must be in the future.", "يجب أن يكون موعد المقابلة في المستقبل."],
  [/duration must be between/i, "Duration must be between 15 and 240 minutes.", "يجب أن تكون المدة بين 15 و240 دقيقة."],
  [/not accepting access requests/i, "This organization is not accepting access requests.", "هذه الجهة لا تستقبل طلبات انضمام حاليًا."],
  [/request is already pending/i, "A request is already pending.", "لديك طلب قيد المراجعة."],
  [/already have access to this organization/i, "You already have access to this organization.", "لديك صلاحية الوصول لهذه الجهة."],
  [/only employer accounts can request/i, "Use an employer account to request access.", "استخدم حساب جهة عمل لطلب الانضمام."],
  [/confirm your email first/i, "Confirm your email first.", "أكّد بريدك الإلكتروني أولًا."],
  [/assessment credits exhausted/i, "Your assessment allowance is used up. Contact JADARAH.", "استُنفد رصيد التقييمات. تواصل مع جدارة."],
  [/finalized evaluation is locked/i, "This evaluation is finalized and locked.", "هذا التقييم نهائي ومقفل."],
  [/explain the decision/i, "Explain the decision (at least 10 characters).", "اكتب مبررًا للقرار (10 أحرف على الأقل)."],
  [/feedback is too short/i, "The feedback is too short.", "الملاحظات قصيرة جدًا."],
  [/unknown time zone/i, "Unknown time zone.", "منطقة زمنية غير معروفة."],
  [/can no longer be confirmed/i, "This interview can no longer be confirmed.", "لم يعد بالإمكان تأكيد هذه المقابلة."],
  [
    /permission|not authorized|super admin only|42501/i,
    "You don't have permission to do that.",
    "لا تملك صلاحية تنفيذ ذلك.",
  ],
];

export function localizeError(
  error: { message?: string; code?: string } | null | undefined,
  locale: Locale,
): string {
  const msg = error?.message ?? "";
  for (const [re, en, ar] of KNOWN)
    if (re.test(msg) || (error?.code && re.test(error.code))) return locale === "ar" ? ar : en;
  return locale === "ar"
    ? "تعذّر إكمال الطلب. يُرجى المحاولة مرة أخرى."
    : "The request could not be completed. Please try again.";
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
