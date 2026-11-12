/** Exhibition jobs (one per registry organization, non-technical fields) with their practical tasks and private model solutions. */
import type { Cell, Sheet } from "./office";

export type Criterion = { key: string; en: string; ar: string; max: number; desc: string };
export type Solution = {
  model: string;
  steps: string[];
  approach: string;
  output: string;
  calc?: string;
  evidence: string;
  excellent: string[];
  mistakes: string[];
  score: string;
};
export type Question = {
  type: "multiple_choice" | "case_study" | "file_upload" | "short_answer";
  points: number;
  en: string;
  ar: string;
  options?: { en: string; ar: string; correct?: boolean }[];
  deliverable?: { name: string; format: "DOCX" | "XLSX"; description: string };
  criteria?: Criterion[];
  solution: Solution;
};
export type Job = {
  key: string;
  registry: string;
  short: string;
  field: string;
  title_en: string;
  title_ar: string;
  department: string;
  category: string;
  level: "entry" | "junior" | "mid";
  min_years: number;
  city: string;
  mode: "onsite" | "hybrid";
  salary: [number, number];
  deadline: string;
  description_en: string;
  description_ar: string;
  resp_en: string[];
  resp_ar: string[];
  qual_en: string[];
  qual_ar: string[];
  required: string[];
  preferred: string[];
  appQuestions: { en: string; ar: string }[];
  task: { title_en: string; title_ar: string; desc_en: string; desc_ar: string; minutes: number; difficulty: "beginner" | "intermediate" | "advanced"; questions: Question[] };
  /** Private completed solution file for the file question. */
  solutionFile: { kind: "docx"; lines: string[] } | { kind: "xlsx"; sheets: Sheet[] };
};

const crit = (key: string, en: string, ar: string, max: number, desc: string): Criterion => ({ key, en, ar, max, desc });
const pct = (a: number, b: number) => Math.round((a / b) * 10000) / 100;

// ------------------------------------------------------------------ 1. Ministry of Commerce — Legal Specialist
const REG_EN = `Training regulation (simulated for this task — not an official text):
Art. 3 — An online seller must deliver within the period it states, and in any case within 15 days of payment.
Art. 4 — If delivery is late, the consumer may cancel; the seller must refund the full amount, in the original payment method, within 7 days of the cancellation request. A voucher is not a refund unless the consumer accepts it.
Art. 6 — Advertising that misleads consumers about price, delivery time or quality is prohibited.
Art. 9 — The seller must display its commercial registration number and contact details on its store.
Art. 12 — The supervising authority may issue warnings, order refunds and impose fines for violations.`;
const REG_AR = `لائحة تدريبية (محاكاة لهذه المهمة — ليست نصًا رسميًا):
م3: يلتزم المتجر الإلكتروني بالتسليم خلال المدة التي يعلنها، وبحد أقصى 15 يومًا من الدفع.
م4: عند التأخر يحق للمستهلك الإلغاء، ويلتزم المتجر بردّ كامل المبلغ بوسيلة الدفع نفسها خلال 7 أيام من طلب الإلغاء، ولا تُعد القسيمة استردادًا إلا بموافقة المستهلك.
م6: يُحظر الإعلان المضلل بشأن السعر أو مدة التوصيل أو الجودة.
م9: يلتزم المتجر بإظهار رقم السجل التجاري وبيانات التواصل.
م12: للجهة المشرفة إصدار الإنذار والأمر بالاسترداد وفرض الغرامات.`;
const CASE_EN = `Case: "Rawabi Home" (a fictional online furniture store) received 2,400 SAR on 1 October for a dining set, promising delivery in 10 days. Its advert said "free delivery within 3 days". On 26 October the set had not arrived. The consumer asked to cancel; the store refused a refund and offered a 2,400 SAR store voucher. The store page shows no commercial registration number.`;
const CASE_AR = `الحالة: متجر «روابي هوم» (متجر أثاث إلكتروني افتراضي) استلم 2,400 ريال في 1 أكتوبر مقابل طاولة طعام ووعد بالتسليم خلال 10 أيام، وكان إعلانه يقول «توصيل مجاني خلال 3 أيام». في 26 أكتوبر لم يصل الطلب، فطلب المستهلك الإلغاء، ورفض المتجر الاسترداد وعرض قسيمة شراء بقيمة 2,400 ريال. لا تظهر في صفحة المتجر بيانات السجل التجاري.`;

const legal: Job = {
  key: "moc-legal",
  registry: "ALM-001",
  short: "moc",
  field: "Legal & compliance",
  title_en: "Legal Specialist — Commercial Regulations",
  title_ar: "أخصائي قانوني — الأنظمة التجارية",
  department: "Legal Affairs",
  category: "public-sector",
  level: "junior",
  min_years: 1,
  city: "Riyadh",
  mode: "onsite",
  salary: [11000, 15000],
  deadline: "2026-12-15",
  description_en:
    "Department: Legal Affairs. Review consumer complaints and commercial practices against the applicable regulations, prepare legal memos and recommend enforcement actions. Practice scenario for skills-based hiring on JADARAH.",
  description_ar: "الإدارة: الشؤون القانونية. مراجعة شكاوى المستهلكين والممارسات التجارية وفق الأنظمة، وإعداد المذكرات القانونية، واقتراح الإجراءات النظامية. سيناريو تدريبي للتوظيف المبني على المهارات في جدارة.",
  resp_en: ["Analyse complaints and identify regulatory violations", "Draft legal memos and notices", "Recommend enforcement actions and required evidence", "Summarise regulations for operational teams"],
  resp_ar: ["تحليل الشكاوى وتحديد المخالفات النظامية", "صياغة المذكرات والإنذارات القانونية", "اقتراح الإجراءات النظامية والأدلة المطلوبة", "تلخيص الأنظمة للفرق التشغيلية"],
  qual_en: ["Bachelor of Laws", "1+ year in legal research or practice", "Excellent Arabic legal drafting; good English"],
  qual_ar: ["بكالوريوس قانون", "سنة خبرة أو أكثر في البحث أو الممارسة القانونية", "صياغة قانونية عربية متميزة وإنجليزية جيدة"],
  required: ["Regulatory Compliance", "Policy Analysis", "Arabic & English Business Writing"],
  preferred: ["Consumer Protection", "Critical Thinking"],
  appQuestions: [
    { en: "Describe a legal memo you drafted and the decision it supported.", ar: "صف مذكرة قانونية أعددتها والقرار الذي دعمته." },
    { en: "Which areas of commercial regulation interest you most, and why?", ar: "ما مجالات الأنظمة التجارية التي تهمك أكثر ولماذا؟" },
  ],
  task: {
    title_en: "Consumer complaint legal review",
    title_ar: "مراجعة قانونية لشكوى مستهلك",
    desc_en: `${REG_EN}\n\n${CASE_EN}\n\nAnswer the four questions using only the training regulation above.`,
    desc_ar: `${REG_AR}\n\n${CASE_AR}\n\nأجب عن الأسئلة الأربعة بالاستناد إلى اللائحة التدريبية أعلاه فقط.`,
    minutes: 75,
    difficulty: "intermediate",
    questions: [
      {
        type: "multiple_choice",
        points: 2,
        en: "Under Art. 4, the store offered a voucher instead of a refund. Which statement is correct?",
        ar: "وفق المادة 4، عرض المتجر قسيمة بدل الاسترداد. أي العبارات صحيحة؟",
        options: [
          { en: "The consumer is entitled to a full refund within 7 days; a voucher only counts if the consumer accepts it", ar: "يحق للمستهلك استرداد كامل المبلغ خلال 7 أيام، ولا تُحتسب القسيمة إلا بموافقته", correct: true },
          { en: "A voucher of equal value fully satisfies the store's obligation", ar: "القسيمة المساوية للقيمة تفي بالتزام المتجر كاملًا" },
          { en: "The consumer must wait 30 days before requesting a refund", ar: "على المستهلك الانتظار 30 يومًا قبل طلب الاسترداد" },
          { en: "Refunds apply only when the product is defective", ar: "لا يكون الاسترداد إلا عند عيب المنتج" },
        ],
        solution: {
          model: "Option 1. Art. 4 gives the consumer a right to cancel after late delivery and requires a full refund in the original payment method within 7 days; a voucher is not a refund unless the consumer accepts it.",
          steps: ["Delivery was due by 11 October (10 days) and is late", "Art. 4 applies: cancellation + refund within 7 days", "The consumer refused the voucher, so it does not discharge the obligation"],
          approach: "Match the facts (late delivery, voucher offer) to the specific article.",
          output: "Option 1 selected.",
          evidence: "Selected option.",
          excellent: ["Correct option"],
          mistakes: ["Treating a voucher as equivalent to a refund"],
          score: "2/2 (scored automatically)",
        },
      },
      {
        type: "case_study",
        points: 6,
        en: "Question 2 — Violations\n\nList every violation in the case. For each, cite the article, the facts that prove it, and the consumer's remedy with its deadline.",
        ar: "السؤال 2 — المخالفات\n\nاذكر كل مخالفة في الحالة مع المادة والوقائع المثبتة لها وحق المستهلك ومهلته.",
        criteria: [
          crit("violations", "All violations identified", "تحديد جميع المخالفات", 2, "late delivery (Art. 3), refused refund/voucher (Art. 4), misleading ad (Art. 6), missing CR number (Art. 9)"),
          crit("articles", "Correct article for each fact", "ربط كل واقعة بالمادة الصحيحة", 2, "each violation tied to the right article with the supporting fact and dates"),
          crit("remedies", "Remedies and deadlines", "الحقوق والمهل", 2, "full refund in original method within 7 days of the cancellation request; authority powers under Art. 12"),
        ],
        solution: {
          model:
            "1) Late delivery — Art. 3: paid 1 Oct, promised 10 days (due 11 Oct), still undelivered on 26 Oct (25 days, also beyond the 15-day cap). 2) Refusal to refund — Art. 4: after late delivery the consumer cancelled; the store must refund 2,400 SAR in the original payment method within 7 days of the request; the voucher does not count because the consumer did not accept it. 3) Misleading advertising — Art. 6: the advert promised free delivery within 3 days while the store itself promised 10 and delivered nothing in 25. 4) Missing commercial registration — Art. 9: the store page shows no CR number. Remedies: cancellation and full refund within 7 days; the authority may warn, order the refund and fine (Art. 12).",
          steps: ["Build the timeline (1 Oct payment → 11 Oct due → 15 Oct legal cap → 26 Oct still late)", "Test each fact against Arts. 3, 4, 6, 9", "State the consumer remedy with its deadline", "Note the authority's powers"],
          approach: "Issue-by-issue analysis: fact → rule → conclusion, with dates.",
          output: "Four violations, each with article, proof and remedy.",
          calc: "Days late: 26 Oct − 1 Oct = 25 days (> 10 promised, > 15 cap).",
          evidence: "Written answer.",
          excellent: ["All four violations", "Dates computed", "Voucher rule explained", "Mentions Art. 12 powers"],
          mistakes: ["Missing the Art. 9 CR-number violation", "Calling the voucher a valid settlement", "No deadline for the refund"],
          score: "6/6",
        },
      },
      {
        type: "file_upload",
        points: 8,
        en: "Question 3 — Legal memo (DOCX)\n\nWrite a legal memo to the Director of Consumer Protection with these sections: Facts, Issues, Analysis (with articles), Recommended actions, Evidence to request from the store.",
        ar: "السؤال 3 — مذكرة قانونية (DOCX)\n\nاكتب مذكرة قانونية إلى مدير حماية المستهلك تتضمن: الوقائع، المسائل، التحليل مع المواد، الإجراءات الموصى بها، الأدلة المطلوبة من المتجر.",
        deliverable: { name: "legal_memo.docx", format: "DOCX", description: "Memo with Facts, Issues, Analysis, Recommended actions and Evidence sections" },
        criteria: [
          crit("structure", "Memo structure", "بنية المذكرة", 2, "all five sections present and addressed to the director"),
          crit("analysis", "Legal analysis with articles", "التحليل القانوني بالمواد", 3, "correct application of Arts. 3, 4, 6 and 9 to the facts"),
          crit("actions", "Actions and evidence", "الإجراءات والأدلة", 3, "proportionate actions (refund order, warning, fine under Art. 12) and a concrete evidence list (payment record, advert capture, delivery log, store page)"),
        ],
        solution: {
          model: "See the solution file legal_memo_solution.docx: a one-page memo with the five sections, the four violations and a concrete action/evidence plan.",
          steps: ["Facts in date order", "Issues as questions", "Analysis per article", "Actions: order refund within 7 days, written warning, fine for Arts. 6 and 9", "Evidence list"],
          approach: "Standard legal memo (facts–issues–analysis–recommendation).",
          output: "DOCX memo, one to two pages.",
          evidence: "legal_memo.docx",
          excellent: ["Clear headings", "Actions proportionate and tied to Art. 12", "Evidence list is specific"],
          mistakes: ["No evidence section", "Recommending criminal penalties not in the regulation", "Analysis without articles"],
          score: "8/8",
        },
      },
      {
        type: "short_answer",
        points: 4,
        en: "Question 4 — Notice to the store\n\nWrite a two- to three-sentence formal notice to the store stating its obligation and the deadline.",
        ar: "السؤال 4 — إنذار للمتجر\n\nاكتب إنذارًا رسميًا من جملتين إلى ثلاث يوضح التزام المتجر والمهلة.",
        criteria: [
          crit("obligation", "Obligation and deadline", "الالتزام والمهلة", 2, "full refund of 2,400 SAR in the original method within 7 days, citing Art. 4"),
          crit("tone", "Formal, clear demand", "لغة رسمية وطلب واضح", 2, "professional tone and the consequence of non-compliance (Art. 12)"),
        ],
        solution: {
          model:
            "To Rawabi Home: Under Art. 4 of the regulation you must refund the consumer the full amount of 2,400 SAR, in the original payment method, within 7 days of the cancellation request; the voucher offered does not discharge this obligation. Please also display your commercial registration number (Art. 9). Failure to comply will be referred for action under Art. 12.",
          steps: ["Name the party", "State obligation + amount + method + deadline", "State consequence"],
          approach: "Short formal notice.",
          output: "Two to three sentences.",
          evidence: "Written answer.",
          excellent: ["Amount, method and deadline all stated", "Cites the article", "States the consequence"],
          mistakes: ["Threatening tone", "No deadline"],
          score: "4/4",
        },
      },
    ],
  },
  solutionFile: {
    kind: "docx",
    lines: [
      "MEMORANDUM — Consumer complaint against Rawabi Home (model solution)",
      "To: Director of Consumer Protection   From: Legal Specialist   Date: 27 October",
      "1. Facts",
      "On 1 October the consumer paid 2,400 SAR for a dining set; the store promised delivery in 10 days and advertised free delivery within 3 days. On 26 October (25 days after payment) the set had not been delivered. The consumer requested cancellation; the store refused a refund and offered a 2,400 SAR voucher. The store page shows no commercial registration number.",
      "2. Issues",
      "(a) Is the delivery late under Art. 3? (b) Must the store refund under Art. 4, and does the voucher discharge that duty? (c) Is the advert misleading under Art. 6? (d) Does the store comply with Art. 9?",
      "3. Analysis",
      "(a) Delivery was due by 11 October and in any case by 16 October (15-day cap). 25 days without delivery breaches Art. 3.",
      "(b) Art. 4 gives the consumer the right to cancel after late delivery; the store must refund 2,400 SAR in the original payment method within 7 days of the request. The consumer did not accept the voucher, so it is not a refund.",
      "(c) Advertising 3-day free delivery while promising 10 days and delivering nothing in 25 misleads on delivery time, breaching Art. 6.",
      "(d) No commercial registration number is displayed, breaching Art. 9.",
      "4. Recommended actions (Art. 12)",
      "Order the refund of 2,400 SAR within 7 days; issue a written warning for Arts. 3, 6 and 9; impose a fine for the misleading advert if it continues; require the CR number to be displayed within 5 working days; follow up with the consumer after 7 days.",
      "5. Evidence to request",
      "Payment receipt and transaction record; screenshot/archive of the advert; order confirmation showing the 10-day promise; delivery log; the cancellation request and the store's reply; current store page.",
    ],
  },
};

// ------------------------------------------------------------------ 2. GEA — Public Relations Specialist
const pr: Job = {
  key: "gea-pr",
  registry: "ALM-002",
  short: "gea",
  field: "Marketing & communications",
  title_en: "Public Relations Specialist",
  title_ar: "أخصائي علاقات عامة",
  department: "Corporate Communications",
  category: "events",
  level: "junior",
  min_years: 1,
  city: "Riyadh",
  mode: "hybrid",
  salary: [10000, 14000],
  deadline: "2026-12-20",
  description_en: "Department: Corporate Communications. Plan event communications, manage media relations and respond to public sentiment during seasons and festivals. Practice scenario for skills-based hiring on JADARAH.",
  description_ar: "الإدارة: الاتصال المؤسسي. تخطيط اتصالات الفعاليات وإدارة العلاقات الإعلامية والاستجابة لتفاعل الجمهور خلال المواسم والمهرجانات. سيناريو تدريبي للتوظيف المبني على المهارات في جدارة.",
  resp_en: ["Draft statements, press releases and key messages", "Monitor media and social sentiment", "Coordinate spokespeople and media requests", "Report communication KPIs"],
  resp_ar: ["صياغة البيانات والأخبار الصحفية والرسائل الرئيسية", "رصد التفاعل الإعلامي والاجتماعي", "تنسيق المتحدثين وطلبات الإعلام", "قياس مؤشرات الاتصال"],
  qual_en: ["Bachelor in Public Relations, Media or Marketing", "1+ year in communications or events", "Strong Arabic and English writing"],
  qual_ar: ["بكالوريوس علاقات عامة أو إعلام أو تسويق", "سنة خبرة أو أكثر في الاتصال أو الفعاليات", "كتابة عربية وإنجليزية قوية"],
  required: ["Communication", "Stakeholder Management", "Arabic & English Business Writing"],
  preferred: ["Event Planning", "Data Visualization"],
  appQuestions: [{ en: "Share an example of a statement you wrote under time pressure.", ar: "شارك مثالًا لبيان كتبته تحت ضغط الوقت." }],
  task: {
    title_en: "Festival crisis communication",
    title_ar: "اتصال الأزمات في مهرجان",
    desc_en:
      "Scenario (fictional): On opening night of the \"Winter Lights\" festival, ticket scanners failed and entry was delayed by 40 minutes. In 3 hours social media recorded 3,200 mentions, 62% negative. No injuries. The cause (a network outage at the gates) has been fixed. The organiser can offer affected ticket holders a free re-entry pass.",
    desc_ar: "سيناريو افتراضي: في ليلة افتتاح مهرجان «أضواء الشتاء» تعطلت أجهزة مسح التذاكر وتأخر الدخول 40 دقيقة. خلال 3 ساعات رُصدت 3,200 إشارة على المنصات، 62% منها سلبية. لا إصابات. السبب (انقطاع شبكة عند البوابات) عولج. يمكن للمنظم تقديم تذكرة دخول مجانية للمتأثرين.",
    minutes: 60,
    difficulty: "intermediate",
    questions: [
      {
        type: "multiple_choice",
        points: 2,
        en: "What is the first priority in the first hour of a public incident like this?",
        ar: "ما الأولوية الأولى في الساعة الأولى من حادثة علنية كهذه؟",
        options: [
          { en: "Acknowledge promptly with verified facts and what is being done", ar: "الإقرار السريع بالحقائق المؤكدة وما يُتخذ من إجراءات", correct: true },
          { en: "Stay silent until a full investigation is complete", ar: "الصمت حتى اكتمال التحقيق" },
          { en: "Blame the technology supplier publicly", ar: "تحميل المورّد التقني المسؤولية علنًا" },
          { en: "Delete negative comments", ar: "حذف التعليقات السلبية" },
        ],
        solution: { model: "Option 1 — acknowledge quickly with verified facts and actions.", steps: ["Speed + accuracy + action"], approach: "Crisis communication principle.", output: "Option 1.", evidence: "Selected option.", excellent: ["Correct option"], mistakes: ["Choosing silence or blame"], score: "2/2 (automatic)" },
      },
      {
        type: "case_study",
        points: 6,
        en: "Question 2 — Holding statement\n\nWrite the holding statement to publish within the first hour (max 120 words) and list three key messages.",
        ar: "السؤال 2 — البيان الأولي\n\nاكتب البيان الأولي للنشر خلال الساعة الأولى (120 كلمة كحد أقصى) واذكر ثلاث رسائل رئيسية.",
        criteria: [
          crit("acknowledge", "Acknowledgement and empathy", "الإقرار والتعاطف", 2, "apologises for the 40-minute delay without defensiveness"),
          crit("facts", "Verified facts only", "حقائق مؤكدة فقط", 2, "states cause fixed and no injuries; no speculation"),
          crit("next_steps", "Next steps and remedy", "الخطوات التالية والتعويض", 2, "free re-entry pass, how to claim, where updates will be posted"),
        ],
        solution: {
          model:
            "Statement: \"We apologise to everyone who waited to enter Winter Lights tonight. A network outage at the gates stopped ticket scanning for about 40 minutes. The issue has been fixed, entry is running normally and no one was hurt. Every ticket holder affected tonight will receive a free re-entry pass by SMS within 48 hours. Updates will be posted on our official accounts.\" Key messages: (1) We are sorry and we take visitors' time seriously; (2) the cause is fixed and safety was never affected; (3) affected visitors get a free re-entry pass automatically.",
          steps: ["Apologise", "State verified facts", "Remedy + how to claim", "Where updates appear"],
          approach: "Acknowledge–inform–act structure.",
          output: "≤120-word statement + 3 messages.",
          evidence: "Written answer.",
          excellent: ["Specific remedy and timing", "No speculation", "Under 120 words"],
          mistakes: ["Blaming suppliers", "Vague 'we are looking into it' with no action"],
          score: "6/6",
        },
      },
      {
        type: "file_upload",
        points: 8,
        en: "Question 3 — Seven-day communication plan (DOCX)\n\nPrepare a plan covering audiences, channels, messages, spokesperson, daily timeline and KPIs with targets (e.g. negative sentiment and response time).",
        ar: "السؤال 3 — خطة اتصال لسبعة أيام (DOCX)\n\nأعد خطة تشمل الجماهير والقنوات والرسائل والمتحدث والجدول اليومي ومؤشرات الأداء بمستهدفات (مثل نسبة التفاعل السلبي وزمن الاستجابة).",
        deliverable: { name: "communication_plan.docx", format: "DOCX", description: "Seven-day plan with audiences, channels, timeline and KPIs" },
        criteria: [
          crit("audiences", "Audiences and channels", "الجماهير والقنوات", 3, "ticket holders, general public, media, partners mapped to channels"),
          crit("kpis", "Measurable KPIs", "مؤشرات قابلة للقياس", 3, "baseline 62% negative → target (e.g. below 30% by day 7); response time target; pass redemption rate"),
          crit("timeline", "Timeline and owners", "الجدول والمسؤوليات", 2, "day-by-day actions with spokesperson and owners"),
        ],
        solution: {
          model: "See communication_plan_solution.docx.",
          steps: ["Map four audiences to channels", "Day 0–7 actions", "KPIs with baselines and targets", "Spokesperson and approval flow"],
          approach: "Audience-first plan with measurable outcomes.",
          output: "DOCX plan.",
          calc: "Negative mentions baseline: 62% of 3,200 = 1,984.",
          evidence: "communication_plan.docx",
          excellent: ["Baseline numbers used", "Each KPI has a target and a date", "Named owners"],
          mistakes: ["KPIs without targets", "One generic audience"],
          score: "8/8",
        },
      },
      {
        type: "short_answer",
        points: 4,
        en: "Question 4 — Lessons for the next launch\n\nGive two preventive measures for the next opening night and one KPI to track each.",
        ar: "السؤال 4 — دروس للافتتاح القادم\n\nاذكر إجراءين وقائيين لليلة الافتتاح القادمة ومؤشرًا لكل منهما.",
        criteria: [
          crit("measures", "Preventive measures", "إجراءات وقائية", 2, "e.g. backup offline scanning, staggered entry windows"),
          crit("kpi", "KPI per measure", "مؤشر لكل إجراء", 2, "e.g. gate wait time < 10 min, scan failure rate < 0.5%"),
        ],
        solution: {
          model: "1) Offline backup scanning at every gate — KPI: scan failure rate below 0.5%. 2) Staggered entry time slots on tickets — KPI: average gate wait below 10 minutes.",
          steps: ["Address root cause", "Reduce peak load", "Pair each with a KPI"],
          approach: "Root cause + capacity.",
          output: "Two measures with KPIs.",
          evidence: "Written answer.",
          excellent: ["Measures address the actual cause"],
          mistakes: ["KPIs that cannot be measured"],
          score: "4/4",
        },
      },
    ],
  },
  solutionFile: {
    kind: "docx",
    lines: [
      "Winter Lights — 7-day communication plan (model solution)",
      "Situation: 40-minute entry delay; 3,200 mentions in 3 hours, 62% negative (≈1,984 negative mentions); cause fixed; no injuries.",
      "Audiences and channels: (1) Affected ticket holders — SMS and email with the re-entry pass; (2) General public — official social accounts and website banner; (3) Media — press statement and spokesperson availability; (4) Partners and sponsors — direct briefing by the account manager.",
      "Spokesperson: Communications Director; approvals: Event Director + Legal within 30 minutes.",
      "Day 0 (night): holding statement within 1 hour; pinned post; reply template for social care.",
      "Day 1: SMS re-entry passes to all affected ticket holders; media Q&A note; partner briefing.",
      "Day 2: publish 'what happened and what we fixed' explainer with backup-scanning photos.",
      "Days 3–5: positive visitor stories; live gate-wait updates during peak hours.",
      "Day 6: sentiment review; adjust messages.",
      "Day 7: closing update with pass redemption figures.",
      "KPIs: negative sentiment 62% → below 30% by day 7; median social response time below 2 hours; 90% of affected visitors receive the pass within 48 hours; pass redemption ≥ 40% during the season.",
      "Risks: rumours of safety issues — answer with the verified 'no injuries' fact; repeat outage — backup scanning in place before gates open.",
    ],
  },
};

// ------------------------------------------------------------------ 3. Elm — Talent Acquisition Specialist
const FUNNEL: [string, number, number, number, number, number, number, number][] = [
  ["Backend Developer", 420, 120, 60, 18, 5, 3, 41],
  ["Data Analyst", 310, 95, 52, 20, 6, 5, 33],
  ["Product Designer", 150, 40, 22, 9, 3, 1, 55],
];
const funnelTable = FUNNEL.map((r) => `${r[0]}: applicants ${r[1]}, screened ${r[2]}, assessed ${r[3]}, interviewed ${r[4]}, offers ${r[5]}, accepted ${r[6]}, average days to hire ${r[7]}`).join("\n");
const ta: Job = {
  key: "elm-ta",
  registry: "ALM-003",
  short: "elm",
  field: "Human resources",
  title_en: "Talent Acquisition Specialist",
  title_ar: "أخصائي استقطاب مواهب",
  department: "Human Resources",
  category: "business",
  level: "junior",
  min_years: 1,
  city: "Riyadh",
  mode: "hybrid",
  salary: [12000, 16000],
  deadline: "2026-12-18",
  description_en: "Department: Human Resources. Run end-to-end hiring for technology roles, analyse the recruitment funnel and improve candidate experience and onboarding. Practice scenario for skills-based hiring on JADARAH.",
  description_ar: "الإدارة: الموارد البشرية. إدارة التوظيف لوظائف التقنية من البداية للنهاية، وتحليل مسار التوظيف، وتحسين تجربة المرشح والتهيئة. سيناريو تدريبي للتوظيف المبني على المهارات في جدارة.",
  resp_en: ["Manage hiring for assigned roles", "Analyse funnel conversion and time to hire", "Partner with hiring managers", "Design onboarding for new joiners"],
  resp_ar: ["إدارة التوظيف للوظائف المسندة", "تحليل نسب التحويل ومدة التوظيف", "الشراكة مع مديري التوظيف", "تصميم تهيئة الموظفين الجدد"],
  qual_en: ["Bachelor in HR or Business", "1+ year in recruitment", "Comfortable with Excel and reporting"],
  qual_ar: ["بكالوريوس موارد بشرية أو إدارة أعمال", "سنة خبرة أو أكثر في التوظيف", "إتقان Excel والتقارير"],
  required: ["Communication", "Stakeholder Management", "Advanced Excel"],
  preferred: ["Data Visualization"],
  appQuestions: [{ en: "How do you measure the quality of a hiring process?", ar: "كيف تقيس جودة عملية التوظيف؟" }],
  task: {
    title_en: "Recruitment funnel analysis",
    title_ar: "تحليل مسار التوظيف",
    desc_en: `Quarterly hiring data (fictional):\n${funnelTable}`,
    desc_ar: `بيانات التوظيف الربعية (افتراضية):\n${FUNNEL.map((r) => `${r[0]}: متقدمون ${r[1]}، فرز ${r[2]}، تقييم ${r[3]}، مقابلة ${r[4]}، عروض ${r[5]}، قبول ${r[6]}، متوسط أيام التوظيف ${r[7]}`).join("\n")}`,
    minutes: 60,
    difficulty: "intermediate",
    questions: [
      {
        type: "multiple_choice",
        points: 2,
        en: "What is the offer acceptance rate for the Data Analyst role?",
        ar: "ما نسبة قبول العروض لوظيفة محلل البيانات؟",
        options: [
          { en: "83.3% (5 of 6 offers)", ar: "83.3% (5 من 6 عروض)", correct: true },
          { en: "25% (5 of 20 interviews)", ar: "25% (5 من 20 مقابلة)" },
          { en: "1.6% (5 of 310 applicants)", ar: "1.6% (5 من 310 متقدمين)" },
          { en: "60%", ar: "60%" },
        ],
        solution: { model: "Option 1: accepted ÷ offers = 5 ÷ 6 = 83.3%.", steps: ["Acceptance = accepted / offers"], approach: "Definition.", output: "83.3%", calc: "5/6 = 0.833", evidence: "Selected option.", excellent: ["Correct option"], mistakes: ["Dividing by interviews or applicants"], score: "2/2 (automatic)" },
      },
      {
        type: "case_study",
        points: 6,
        en: "Question 2 — Diagnosis\n\nFor each role, identify the weakest stage of the funnel and explain what it suggests, using the numbers.",
        ar: "السؤال 2 — التشخيص\n\nحدد لكل وظيفة أضعف مرحلة في المسار واشرح دلالتها بالأرقام.",
        criteria: [
          crit("numbers", "Correct conversion figures", "نسب تحويل صحيحة", 2, "e.g. Designer acceptance 33.3%, Backend acceptance 60%, Backend interview→offer 27.8%"),
          crit("bottleneck", "Weakest stage per role", "أضعف مرحلة لكل وظيفة", 2, "Designer: offer acceptance and 55 days; Backend: assessed→interviewed 30% and 41 days; Data Analyst: healthy, screening 30.6%"),
          crit("interpretation", "Interpretation", "التفسير", 2, "links stages to likely causes (offer competitiveness, slow process, assessment calibration)"),
        ],
        solution: {
          model:
            "Product Designer: acceptance 1/3 = 33.3% and 55 days to hire — offers are not competitive or arrive too late; candidates accept elsewhere. Backend Developer: only 30% of assessed candidates reach interview (18/60) and acceptance is 60% with 41 days — the assessment may be filtering too hard or interview scheduling is slow. Data Analyst: the healthiest funnel (acceptance 83.3%, 33 days); its weakest point is screening 30.6%, which is normal for a high-volume role.",
          steps: ["Compute stage conversions", "Compare across roles", "Name the weakest stage per role", "Suggest a likely cause"],
          approach: "Stage-to-stage conversion comparison.",
          output: "Three diagnoses with figures.",
          calc: "Backend: 120/420 = 28.6%, 60/120 = 50%, 18/60 = 30%, 5/18 = 27.8%, 3/5 = 60%. Designer: 40/150 = 26.7%, 22/40 = 55%, 9/22 = 40.9%, 3/9 = 33.3%, 1/3 = 33.3%. Data Analyst: 95/310 = 30.6%, 52/95 = 54.7%, 20/52 = 38.5%, 6/20 = 30%, 5/6 = 83.3%.",
          evidence: "Written answer.",
          excellent: ["Uses stage-to-stage conversions, not only overall rates", "Links time to hire to acceptance"],
          mistakes: ["Comparing raw counts across roles of different size", "Ignoring days to hire"],
          score: "6/6",
        },
      },
      {
        type: "file_upload",
        points: 8,
        en: "Question 3 — Funnel workbook (XLSX)\n\nBuild a workbook with the data, a formula for each stage conversion and acceptance rate, overall hire rate, and a sheet of three recommendations tied to the numbers.",
        ar: "السؤال 3 — مصنف المسار (XLSX)\n\nأنشئ مصنفًا بالبيانات ومعادلة لكل نسبة تحويل ونسبة القبول ونسبة التوظيف الإجمالية، وورقة بثلاث توصيات مرتبطة بالأرقام.",
        deliverable: { name: "funnel_analysis.xlsx", format: "XLSX", description: "Data, conversion formulas and a recommendations sheet" },
        criteria: [
          crit("formulas", "Correct conversion formulas", "معادلات تحويل صحيحة", 3, "stage conversions and acceptance computed with formulas, not typed values"),
          crit("bottlenecks", "Bottlenecks highlighted", "إبراز نقاط الاختناق", 3, "weakest stages identified per role consistent with the figures"),
          crit("recommendations", "Recommendations tied to data", "توصيات مرتبطة بالبيانات", 2, "three actionable recommendations each referencing a figure"),
        ],
        solution: { model: "See funnel_analysis_solution.xlsx.", steps: ["Data sheet", "Conversion formulas", "Hire rate", "Recommendations sheet"], approach: "Formula-driven workbook.", output: "XLSX with two sheets.", calc: "Overall hire rate: Backend 3/420 = 0.71%, Data Analyst 5/310 = 1.61%, Designer 1/150 = 0.67%.", evidence: "funnel_analysis.xlsx", excellent: ["Every rate is a formula", "Recommendations cite numbers"], mistakes: ["Hard-coded percentages", "Dividing by the wrong stage"], score: "8/8" },
      },
      {
        type: "short_answer",
        points: 4,
        en: "Question 4 — First 30 days\n\nOutline a 30-day onboarding plan for the new Data Analyst in four bullet points.",
        ar: "السؤال 4 — أول 30 يومًا\n\nضع خطة تهيئة لمحلل البيانات الجديد خلال 30 يومًا في أربع نقاط.",
        criteria: [crit("coverage", "Coverage", "الشمول", 2, "access/tools, buddy, first deliverable, check-ins"), crit("measurable", "Measurable milestones", "مراحل قابلة للقياس", 2, "dated milestones and a 30-day review")],
        solution: { model: "Week 1: accounts, data access and a buddy; Week 2: shadow two dashboards; Week 3: deliver a first small report; Day 30: review with manager against agreed goals.", steps: ["Access", "Learning", "First deliverable", "Review"], approach: "Time-boxed plan.", output: "Four bullets.", evidence: "Written answer.", excellent: ["Dated milestones"], mistakes: ["Generic 'meet the team' only"], score: "4/4" },
      },
    ],
  },
  solutionFile: {
    kind: "xlsx",
    sheets: [
      {
        name: "Funnel",
        rows: [
          ["Role", "Applicants", "Screened", "Assessed", "Interviewed", "Offers", "Accepted", "Days to hire", "Screen %", "Assess %", "Interview %", "Offer %", "Acceptance %", "Hire rate %"],
          ...FUNNEL.map((r, i): Cell[] => {
            const n = i + 2;
            return [r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], { f: `C${n}/B${n}*100`, v: pct(r[2], r[1]) }, { f: `D${n}/C${n}*100`, v: pct(r[3], r[2]) }, { f: `E${n}/D${n}*100`, v: pct(r[4], r[3]) }, { f: `F${n}/E${n}*100`, v: pct(r[5], r[4]) }, { f: `G${n}/F${n}*100`, v: pct(r[6], r[5]) }, { f: `G${n}/B${n}*100`, v: pct(r[6], r[1]) }];
          }),
        ],
      },
      {
        name: "Recommendations",
        rows: [
          ["Role", "Weakest stage", "Recommendation"],
          ["Product Designer", "Acceptance 33.3%, 55 days", "Benchmark the offer package and cut time to offer below 35 days with a single panel interview"],
          ["Backend Developer", "Assessed to interviewed 30%", "Review the assessment pass mark with hiring managers; book interviews within 5 days of assessment"],
          ["Data Analyst", "Screening 30.6% (healthy funnel)", "Keep the process; reuse its 33-day timeline as the standard for other roles"],
        ],
      },
    ],
  },
};

// ------------------------------------------------------------------ 4. DGDA — Procurement Specialist
const BIDS: [string, number, number][] = [
  ["Bidder A", 82, 1150000],
  ["Bidder B", 74, 980000],
  ["Bidder C", 90, 1320000],
];
const procurement: Job = {
  key: "dgda-procurement",
  registry: "ALM-004",
  short: "dgda",
  field: "Operations & supply chain",
  title_en: "Procurement Specialist",
  title_ar: "أخصائي مشتريات",
  department: "Procurement and Contracts",
  category: "business",
  level: "junior",
  min_years: 1,
  city: "Diriyah",
  mode: "onsite",
  salary: [11000, 15000],
  deadline: "2026-12-22",
  description_en: "Department: Procurement and Contracts. Prepare tenders, evaluate bids fairly, and manage supplier contracts for heritage and urban development projects. Practice scenario for skills-based hiring on JADARAH.",
  description_ar: "الإدارة: المشتريات والعقود. إعداد المنافسات وتقييم العروض بعدالة وإدارة عقود الموردين لمشاريع التراث والتطوير العمراني. سيناريو تدريبي للتوظيف المبني على المهارات في جدارة.",
  resp_en: ["Prepare tender documents and evaluation criteria", "Evaluate technical and financial bids", "Draft award recommendations", "Track supplier performance and contract risks"],
  resp_ar: ["إعداد كراسات المنافسة ومعايير التقييم", "تقييم العروض الفنية والمالية", "صياغة توصيات الترسية", "متابعة أداء الموردين ومخاطر العقود"],
  qual_en: ["Bachelor in Supply Chain, Business or Engineering", "1+ year in procurement", "Strong Excel skills"],
  qual_ar: ["بكالوريوس سلاسل إمداد أو إدارة أو هندسة", "سنة خبرة أو أكثر في المشتريات", "مهارة عالية في Excel"],
  required: ["Vendor Management", "Cost Estimation", "Advanced Excel"],
  preferred: ["Regulatory Compliance"],
  appQuestions: [{ en: "How do you ensure fairness in a bid evaluation?", ar: "كيف تضمن العدالة في تقييم العروض؟" }],
  task: {
    title_en: "Heritage signage tender evaluation",
    title_ar: "تقييم منافسة لوحات إرشادية تراثية",
    desc_en:
      "Tender (fictional): wayfinding signage for a heritage district. Evaluation: technical 60%, price 40%. Minimum technical score to qualify: 75/100. Price score = (lowest qualified price ÷ bid price) × 100.\n" +
      BIDS.map((b) => `${b[0]}: technical ${b[1]}/100, price ${b[2].toLocaleString("en-US")} SAR`).join("\n"),
    desc_ar:
      "منافسة افتراضية: لوحات إرشادية لحي تراثي. التقييم: فني 60% ومالي 40%. الحد الأدنى للتأهل الفني 75/100. الدرجة المالية = (أقل سعر مؤهل ÷ سعر العرض) × 100.\n" +
      BIDS.map((b) => `${b[0]}: فني ${b[1]}/100، السعر ${b[2].toLocaleString("en-US")} ريال`).join("\n"),
    minutes: 60,
    difficulty: "intermediate",
    questions: [
      {
        type: "multiple_choice",
        points: 2,
        en: "Why does a tender set a minimum technical score?",
        ar: "لماذا تحدد المنافسة حدًا أدنى للدرجة الفنية؟",
        options: [
          { en: "So a low price cannot win with an unacceptable technical offer", ar: "حتى لا يفوز سعر منخفض بعرض فني غير مقبول", correct: true },
          { en: "To make the cheapest bid always win", ar: "ليفوز الأرخص دائمًا" },
          { en: "To avoid evaluating prices", ar: "لتجنب تقييم الأسعار" },
          { en: "Because technical scores are optional", ar: "لأن الدرجة الفنية اختيارية" },
        ],
        solution: { model: "Option 1.", steps: ["Threshold protects quality"], approach: "Principle.", output: "Option 1.", evidence: "Selected option.", excellent: ["Correct option"], mistakes: ["Thinking the threshold favours price"], score: "2/2 (automatic)" },
      },
      {
        type: "case_study",
        points: 6,
        en: "Question 2 — Evaluation outcome\n\nApply the threshold, compute the price and weighted scores for the qualified bidders, and state the recommended award with your reasoning.",
        ar: "السؤال 2 — نتيجة التقييم\n\nطبّق الحد الأدنى واحسب الدرجات المالية والموزونة للعروض المؤهلة وحدد الترسية الموصى بها مع التبرير.",
        criteria: [
          crit("threshold", "Threshold applied", "تطبيق الحد الأدنى", 2, "Bidder B (74) is disqualified before price scoring"),
          crit("scores", "Correct scores", "درجات صحيحة", 2, "lowest qualified price 1,150,000: A price 100 → weighted 89.2; C price 87.12 → weighted 88.85"),
          crit("award", "Award and reasoning", "الترسية والتبرير", 2, "award to A (89.2) and note the narrow margin vs C"),
        ],
        solution: {
          model:
            "Bidder B scores 74 < 75 and is disqualified. Qualified: A and C; lowest qualified price = 1,150,000. A: price 100; weighted 0.6×82 + 0.4×100 = 89.2. C: price 1,150,000/1,320,000×100 = 87.12; weighted 0.6×90 + 0.4×87.12 = 88.85. Recommend award to Bidder A (89.2), noting the margin over C is only 0.35 points, so the technical evaluation record must be well documented.",
          steps: ["Disqualify B", "Lowest qualified price = A's price", "Price scores", "Weighted totals", "Rank and recommend"],
          approach: "Two-envelope evaluation with threshold.",
          output: "Award to A (89.20) over C (88.85).",
          calc: "A: 49.2 + 40.0 = 89.20; C: 54.0 + 34.85 = 88.85.",
          evidence: "Written answer.",
          excellent: ["Applies threshold before price", "Uses lowest QUALIFIED price", "Mentions narrow margin"],
          mistakes: ["Using B's price as the lowest price (gives A 85.2 and C 74.2 and a wrong ranking basis)", "Ignoring the threshold and awarding to B"],
          score: "6/6",
        },
      },
      {
        type: "file_upload",
        points: 8,
        en: "Question 3 — Evaluation sheet (XLSX)\n\nBuild the evaluation sheet with formulas: qualification flag, price score, weighted total and rank. Add a short award recommendation row.",
        ar: "السؤال 3 — ورقة التقييم (XLSX)\n\nأنشئ ورقة التقييم بالمعادلات: مؤشر التأهل، الدرجة المالية، الدرجة الموزونة، الترتيب، مع صف توصية مختصر.",
        deliverable: { name: "bid_evaluation.xlsx", format: "XLSX", description: "Qualification, price score, weighted total and rank with formulas" },
        criteria: [
          crit("price_formula", "Price score formula", "معادلة الدرجة المالية", 3, "lowest qualified price ÷ bid price × 100, as a formula"),
          crit("threshold", "Threshold in the sheet", "الحد الأدنى في الورقة", 3, "qualification flag excludes B from price scoring and ranking"),
          crit("ranking", "Ranking and recommendation", "الترتيب والتوصية", 2, "correct ranking A, C and a recommendation row"),
        ],
        solution: { model: "See bid_evaluation_solution.xlsx.", steps: ["Inputs", "Qualified flag", "Price score", "Weighted", "Rank"], approach: "Formula-driven evaluation sheet.", output: "XLSX.", evidence: "bid_evaluation.xlsx", excellent: ["Formulas reference cells", "B excluded by formula"], mistakes: ["Typed values", "B ranked first"], score: "8/8" },
      },
      {
        type: "short_answer",
        points: 4,
        en: "Question 4 — Contract risks\n\nName two contract risks for this project and the clause that mitigates each.",
        ar: "السؤال 4 — مخاطر العقد\n\nاذكر خطرين تعاقديين لهذا المشروع والبند الذي يخفف كلًا منهما.",
        criteria: [crit("risks", "Relevant risks", "مخاطر ملائمة", 2, "e.g. heritage approval delays, quality of materials near historic structures"), crit("clauses", "Mitigating clauses", "بنود التخفيف", 2, "e.g. delay penalties with approval milestones, material approval and warranty clauses")],
        solution: { model: "1) Delay from heritage approvals — milestone schedule with liquidated damages that exclude authority-caused delays. 2) Damage or unsuitable materials near historic fabric — material approval before installation, method statement, 2-year warranty and performance bond.", steps: ["Project-specific risks", "Matching clauses"], approach: "Risk → clause.", output: "Two pairs.", evidence: "Written answer.", excellent: ["Heritage-specific"], mistakes: ["Generic risks only"], score: "4/4" },
      },
    ],
  },
  solutionFile: {
    kind: "xlsx",
    sheets: [
      {
        name: "Evaluation",
        rows: [
          ["Bidder", "Technical", "Price (SAR)", "Qualified (>=75)", "Price score", "Weighted total", "Rank"],
          ["Bidder A", 82, 1150000, { f: 'IF(B2>=75,"Yes","No")', v: "Yes" }, { f: 'IF(D2="Yes",MINIFS($C$2:$C$4,$D$2:$D$4,"Yes")/C2*100,"")', v: 100 }, { f: 'IF(D2="Yes",0.6*B2+0.4*E2,"")', v: 89.2 }, { f: "RANK(F2,$F$2:$F$4)", v: 1 }],
          ["Bidder B", 74, 980000, { f: 'IF(B3>=75,"Yes","No")', v: "No" }, { f: 'IF(D3="Yes",MINIFS($C$2:$C$4,$D$2:$D$4,"Yes")/C3*100,"")', v: "" }, { f: 'IF(D3="Yes",0.6*B3+0.4*E3,"")', v: "" }, "Not qualified"],
          ["Bidder C", 90, 1320000, { f: 'IF(B4>=75,"Yes","No")', v: "Yes" }, { f: 'IF(D4="Yes",MINIFS($C$2:$C$4,$D$2:$D$4,"Yes")/C4*100,"")', v: 87.12 }, { f: 'IF(D4="Yes",0.6*B4+0.4*E4,"")', v: 88.85 }, { f: "RANK(F4,$F$2:$F$4)", v: 2 }],
          [],
          ["Recommendation", "Award to Bidder A (89.20). Bidder B fails the 75 technical threshold. Margin over Bidder C is 0.35 points; keep the technical evaluation record."],
        ],
      },
    ],
  },
};

// ------------------------------------------------------------------ 5. stc — Customer Experience Specialist
const COMPLAINTS: [string, number, number, number][] = [
  ["Billing", 1240, 52, 2.9],
  ["Network coverage", 860, 96, 2.4],
  ["App login", 690, 20, 3.1],
  ["Device delivery", 410, 30, 3.6],
  ["Roaming", 150, 70, 2.7],
];
const totalComplaints = COMPLAINTS.reduce((a, r) => a + r[1], 0);
const cxScore = (r: (typeof COMPLAINTS)[number]) => (r[1] / totalComplaints) * 100 * (5 - r[3]) * (r[2] / 24);
const CX_RANK = COMPLAINTS.map((r) => COMPLAINTS.filter((x) => cxScore(x) > cxScore(r)).length + 1);
const cx: Job = {
  key: "stc-cx",
  registry: "ALM-005",
  short: "stc",
  field: "Customer experience & product",
  title_en: "Customer Experience Specialist",
  title_ar: "أخصائي تجربة العملاء",
  department: "Customer Experience",
  category: "product",
  level: "junior",
  min_years: 1,
  city: "Riyadh",
  mode: "hybrid",
  salary: [11000, 15000],
  deadline: "2026-12-20",
  description_en: "Department: Customer Experience. Analyse complaints and journey data, prioritise improvements and track satisfaction KPIs across digital and retail channels. Practice scenario for skills-based hiring on JADARAH.",
  description_ar: "الإدارة: تجربة العملاء. تحليل الشكاوى وبيانات رحلة العميل وترتيب أولويات التحسين ومتابعة مؤشرات الرضا عبر القنوات الرقمية والمتاجر. سيناريو تدريبي للتوظيف المبني على المهارات في جدارة.",
  resp_en: ["Analyse complaint and survey data", "Prioritise pain points with business impact", "Propose and track improvements", "Report CSAT/NPS and resolution KPIs"],
  resp_ar: ["تحليل بيانات الشكاوى والاستبيانات", "ترتيب نقاط الألم حسب الأثر", "اقتراح التحسينات ومتابعتها", "قياس الرضا وصافي الترويج ومؤشرات الحل"],
  qual_en: ["Bachelor in Business, Marketing or related", "1+ year in customer service or CX", "Data analysis with Excel"],
  qual_ar: ["بكالوريوس إدارة أو تسويق أو ما يماثله", "سنة خبرة أو أكثر في خدمة العملاء أو تجربتهم", "تحليل البيانات باستخدام Excel"],
  required: ["Customer Experience", "Root Cause Analysis", "Communication"],
  preferred: ["Data Visualization"],
  appQuestions: [{ en: "Describe an improvement you made that reduced repeat customer contacts.", ar: "صف تحسينًا قمت به قلل تكرار تواصل العملاء." }],
  task: {
    title_en: "Complaint prioritisation (Pareto)",
    title_ar: "ترتيب أولويات الشكاوى (باريتو)",
    desc_en: `Monthly complaints (fictional), with average resolution time (hours) and CSAT (1–5):\n${COMPLAINTS.map((r) => `${r[0]}: ${r[1]} complaints, ${r[2]} h, CSAT ${r[3]}`).join("\n")}\nTotal: ${totalComplaints}`,
    desc_ar: `الشكاوى الشهرية (افتراضية) مع متوسط زمن الحل بالساعات ورضا العملاء (1–5):\n${COMPLAINTS.map((r) => `${r[0]}: ${r[1]} شكوى، ${r[2]} ساعة، رضا ${r[3]}`).join("\n")}\nالإجمالي: ${totalComplaints}`,
    minutes: 60,
    difficulty: "intermediate",
    questions: [
      {
        type: "multiple_choice",
        points: 2,
        en: "How is Net Promoter Score (NPS) calculated?",
        ar: "كيف يُحسب صافي نقاط الترويج (NPS)؟",
        options: [
          { en: "% promoters (9–10) minus % detractors (0–6)", ar: "نسبة المروجين (9–10) ناقص نسبة المنتقدين (0–6)", correct: true },
          { en: "Average of all scores", ar: "متوسط جميع الدرجات" },
          { en: "% satisfied customers", ar: "نسبة العملاء الراضين" },
          { en: "Promoters divided by passives", ar: "المروجون ÷ المحايدون" },
        ],
        solution: { model: "Option 1.", steps: ["Definition"], approach: "Definition.", output: "Option 1.", evidence: "Selected option.", excellent: ["Correct"], mistakes: ["Confusing with CSAT"], score: "2/2 (automatic)" },
      },
      {
        type: "case_study",
        points: 6,
        en: "Question 2 — Priorities\n\nChoose the two issues to fix first and justify using volume share, resolution time and CSAT.",
        ar: "السؤال 2 — الأولويات\n\nاختر مشكلتين للبدء بهما وبرّر اختيارك بنسبة الحجم وزمن الحل والرضا.",
        criteria: [
          crit("shares", "Correct shares", "نسب صحيحة", 2, "Billing 37.0%, Network 25.7%, App login 20.6%, Device 12.2%, Roaming 4.5%"),
          crit("choice", "Sound choice", "اختيار سليم", 2, "Billing (largest volume) and Network coverage (lowest CSAT 2.4, longest 96 h)"),
          crit("reasoning", "Combines volume and severity", "الجمع بين الحجم والشدة", 2, "explains trade-off; notes App login is high volume but fast to resolve"),
        ],
        solution: {
          model: "Billing (1,240 = 37.0%, CSAT 2.9, 52 h) and Network coverage (860 = 25.7%, lowest CSAT 2.4, slowest 96 h). Together they are 62.7% of complaints. App login is 20.6% but resolved in 20 h with CSAT 3.1, so it is third. Roaming has poor CSAT but only 4.5% of volume.",
          steps: ["Shares", "Severity", "Combine", "Choose"],
          approach: "Volume × severity.",
          output: "Billing and Network coverage.",
          calc: `Billing 1240/${totalComplaints} = 37.0%; Network 860/${totalComplaints} = 25.7%; cumulative 62.7%.`,
          evidence: "Written answer.",
          excellent: ["Cites shares and severity", "Explains why App login is not first"],
          mistakes: ["Choosing by volume only", "Choosing Roaming because CSAT is low despite tiny volume"],
          score: "6/6",
        },
      },
      {
        type: "file_upload",
        points: 8,
        en: "Question 3 — Pareto workbook (XLSX)\n\nBuild a workbook with share %, cumulative %, a priority score (your formula combining volume and severity) and the resulting ranking.",
        ar: "السؤال 3 — مصنف باريتو (XLSX)\n\nأنشئ مصنفًا بالنسبة والنسبة التراكمية ودرجة أولوية (معادلتك التي تجمع الحجم والشدة) والترتيب الناتج.",
        deliverable: { name: "complaints_pareto.xlsx", format: "XLSX", description: "Share, cumulative share, priority score and ranking with formulas" },
        criteria: [
          crit("pareto", "Share and cumulative formulas", "معادلات النسبة والتراكم", 3, "correct sorted shares and cumulative % with formulas"),
          crit("priority", "Priority score", "درجة الأولوية", 3, "explicit formula combining volume with CSAT gap and/or resolution time"),
          crit("ranking", "Ranking consistent", "ترتيب متسق", 2, "ranking follows the score; top two Billing and Network"),
        ],
        solution: { model: "See complaints_pareto_solution.xlsx. Priority score = share% × (5 − CSAT) × (hours ÷ 24).", steps: ["Sort by volume", "Share and cumulative", "Score", "Rank"], approach: "Pareto plus severity weighting.", output: "XLSX.", calc: "Billing 37.0×2.1×2.17 = 168.6; Network 25.7×2.6×4.0 = 266.8; App 20.6×1.9×0.83 = 32.6; Device 12.2×1.4×1.25 = 21.4; Roaming 4.5×2.3×2.92 = 30.1.", evidence: "complaints_pareto.xlsx", excellent: ["Formulas", "Score stated"], mistakes: ["Unsorted Pareto", "Typed numbers"], score: "8/8" },
      },
      {
        type: "short_answer",
        points: 4,
        en: "Question 4 — Improvements\n\nPropose three improvements with one KPI target each.",
        ar: "السؤال 4 — التحسينات\n\nاقترح ثلاثة تحسينات مع مستهدف لمؤشر لكل منها.",
        criteria: [crit("improvements", "Relevant improvements", "تحسينات ملائمة", 2, "address billing clarity, network complaint handling, login"), crit("targets", "KPI targets", "مستهدفات المؤشرات", 2, "numeric targets with time frame")],
        solution: { model: "1) Itemised bill explainer in the app — billing complaints −20% in 3 months. 2) Network complaint triage with coverage map and engineer callback — resolution time 96 h → 48 h. 3) One-tap OTP login fix — login complaints −40%, CSAT ≥ 3.8.", steps: ["Issue → fix → KPI"], approach: "Targeted fixes.", output: "Three pairs.", evidence: "Written answer.", excellent: ["Numeric targets"], mistakes: ["No targets"], score: "4/4" },
      },
    ],
  },
  solutionFile: {
    kind: "xlsx",
    sheets: [
      {
        name: "Pareto",
        rows: [
          ["Category", "Complaints", "Hours", "CSAT", "Share %", "Cumulative %", "Priority score", "Rank"],
          ...COMPLAINTS.map((r, i): Cell[] => {
            const n = i + 2;
            const share = pct(r[1], totalComplaints);
            const cum = pct(COMPLAINTS.slice(0, i + 1).reduce((a, x) => a + x[1], 0), totalComplaints);
            const score = Math.round(share * (5 - r[3]) * (r[2] / 24) * 10) / 10;
            return [r[0], r[1], r[2], r[3], { f: `B${n}/SUM($B$2:$B$6)*100`, v: share }, { f: `SUM($B$2:B${n})/SUM($B$2:$B$6)*100`, v: cum }, { f: `E${n}*(5-D${n})*(C${n}/24)`, v: score }, { f: `RANK(G${n},$G$2:$G$6)`, v: CX_RANK[i] }];
          }),
          ["Total", { f: "SUM(B2:B6)", v: totalComplaints }],
        ],
      },
    ],
  },
};

// ------------------------------------------------------------------ 6. SDAIA — Strategy Analyst
const strategy: Job = {
  key: "sdaia-strategy",
  registry: "ALM-006",
  short: "sdaia",
  field: "Business & strategy",
  title_en: "Strategy Analyst",
  title_ar: "محلل استراتيجي",
  department: "Strategy and Transformation",
  category: "business",
  level: "junior",
  min_years: 1,
  city: "Riyadh",
  mode: "hybrid",
  salary: [13000, 18000],
  deadline: "2026-12-25",
  description_en: "Department: Strategy and Transformation. Analyse adoption of data and AI services across government entities, design initiatives and track OKRs. Practice scenario for skills-based hiring on JADARAH.",
  description_ar: "الإدارة: الاستراتيجية والتحول. تحليل تبني خدمات البيانات والذكاء الاصطناعي في الجهات الحكومية وتصميم المبادرات ومتابعة الأهداف والنتائج الرئيسية. سيناريو تدريبي للتوظيف المبني على المهارات في جدارة.",
  resp_en: ["Analyse adoption and survey data", "Design initiatives and OKRs", "Prepare strategy briefs for leadership", "Coordinate with stakeholder entities"],
  resp_ar: ["تحليل بيانات التبني والاستبيانات", "تصميم المبادرات والأهداف", "إعداد ملخصات استراتيجية للقيادة", "التنسيق مع الجهات ذات العلاقة"],
  qual_en: ["Bachelor in Economics, Business or Public Policy", "1+ year in research, consulting or strategy", "Clear structured writing"],
  qual_ar: ["بكالوريوس اقتصاد أو إدارة أو سياسات عامة", "سنة خبرة أو أكثر في البحث أو الاستشارات أو الاستراتيجية", "كتابة منظمة وواضحة"],
  required: ["Policy Analysis", "Critical Thinking", "Stakeholder Management"],
  preferred: ["Data Visualization"],
  appQuestions: [{ en: "Describe a recommendation you made that was adopted, and the evidence behind it.", ar: "صف توصية قدمتها وتم تبنيها والأدلة التي استندت إليها." }],
  task: {
    title_en: "AI platform adoption strategy",
    title_ar: "استراتيجية تبني منصة الذكاء الاصطناعي",
    desc_en: "Situation (fictional): a shared AI services platform targeted 60 government entities in year 1. 24 entities have onboarded; 9 use it every month. Survey of non-active entities — main barriers (multiple answers): data readiness 58%, skills 46%, procurement process 31%, trust and privacy 27%.",
    desc_ar: "الوضع (افتراضي): استهدفت منصة خدمات ذكاء اصطناعي مشتركة 60 جهة حكومية في السنة الأولى. انضمت 24 جهة، وتستخدمها 9 جهات شهريًا. استبيان الجهات غير النشطة — أبرز العوائق (إجابات متعددة): جاهزية البيانات 58%، المهارات 46%، إجراءات الشراء 31%، الثقة والخصوصية 27%.",
    minutes: 75,
    difficulty: "intermediate",
    questions: [
      {
        type: "multiple_choice",
        points: 2,
        en: "Which is a well-formed key result?",
        ar: "أي مما يلي نتيجة رئيسية مصاغة جيدًا؟",
        options: [
          { en: "Raise monthly active entities from 9 to 30 by Q4", ar: "رفع الجهات النشطة شهريًا من 9 إلى 30 بنهاية الربع الرابع", correct: true },
          { en: "Improve adoption", ar: "تحسين التبني" },
          { en: "Hold more workshops", ar: "عقد مزيد من ورش العمل" },
          { en: "Be the best AI platform", ar: "أن نكون أفضل منصة" },
        ],
        solution: { model: "Option 1 — measurable baseline, target and date.", steps: ["Measurable"], approach: "OKR principle.", output: "Option 1.", evidence: "Selected option.", excellent: ["Correct"], mistakes: ["Activity instead of outcome"], score: "2/2 (automatic)" },
      },
      {
        type: "case_study",
        points: 6,
        en: "Question 2 — Diagnosis\n\nQuantify the adoption gap (onboarding and activation) and explain which barriers matter most.",
        ar: "السؤال 2 — التشخيص\n\nاحسب فجوة التبني (الانضمام والتفعيل) وبيّن أهم العوائق.",
        criteria: [
          crit("gap", "Quantified gap", "فجوة محسوبة", 2, "onboarding 24/60 = 40%; activation 9/24 = 37.5%; 9/60 = 15% of target active"),
          crit("barriers", "Barrier prioritisation", "ترتيب العوائق", 2, "data readiness and skills are the top barriers"),
          crit("insight", "Insight", "الاستنتاج", 2, "activation, not only onboarding, is the core problem"),
        ],
        solution: { model: "Onboarding reached 40% of target (24/60) but only 37.5% of onboarded entities are active (9/24) — 15% of the target overall. The problem is activation after onboarding. Data readiness (58%) and skills (46%) dominate; procurement (31%) and trust (27%) are secondary but block specific entities.", steps: ["Ratios", "Rank barriers", "Conclude"], approach: "Funnel + barrier analysis.", output: "Gap and priorities.", calc: "24/60 = 40%; 9/24 = 37.5%; 9/60 = 15%.", evidence: "Written answer.", excellent: ["Separates onboarding from activation"], mistakes: ["Only reporting 24 of 60"], score: "6/6" },
      },
      {
        type: "file_upload",
        points: 8,
        en: "Question 3 — Strategy brief (DOCX)\n\nWrite a brief with: diagnosis, three initiatives addressing the top barriers, an OKR per initiative and a 12-month roadmap.",
        ar: "السؤال 3 — ملخص استراتيجي (DOCX)\n\nاكتب ملخصًا يتضمن: التشخيص، وثلاث مبادرات لمعالجة أهم العوائق، وهدفًا ونتيجة رئيسية لكل مبادرة، وخارطة طريق لـ12 شهرًا.",
        deliverable: { name: "strategy_brief.docx", format: "DOCX", description: "Diagnosis, three initiatives with OKRs and a 12-month roadmap" },
        criteria: [
          crit("diagnosis", "Data-grounded diagnosis", "تشخيص مبني على البيانات", 3, "uses 40%, 37.5% and the barrier percentages"),
          crit("initiatives", "Initiatives address barriers", "مبادرات تعالج العوائق", 3, "data readiness, skills and procurement/trust each addressed"),
          crit("okrs", "Measurable OKRs and roadmap", "أهداف قابلة للقياس وخارطة طريق", 2, "baselines, targets, quarters"),
        ],
        solution: { model: "See strategy_brief_solution.docx.", steps: ["Diagnosis", "Initiatives", "OKRs", "Roadmap"], approach: "Problem → initiative → measure.", output: "DOCX brief.", evidence: "strategy_brief.docx", excellent: ["Each initiative mapped to a barrier", "Quarterly roadmap"], mistakes: ["Initiatives unrelated to the survey", "OKRs without baselines"], score: "8/8" },
      },
      {
        type: "short_answer",
        points: 4,
        en: "Question 4 — Stakeholders\n\nName three stakeholder groups and how you would engage each.",
        ar: "السؤال 4 — أصحاب المصلحة\n\nاذكر ثلاث فئات من أصحاب المصلحة وطريقة إشراك كل منها.",
        criteria: [crit("groups", "Relevant groups", "فئات ملائمة", 2, "entity leadership/CDOs, data teams, procurement/legal"), crit("engagement", "Engagement approach", "أسلوب الإشراك", 2, "specific forums, cadence or incentives")],
        solution: { model: "Entity heads/Chief Data Officers — quarterly steering forum with adoption scorecards; data and IT teams — readiness clinics and templates; procurement and legal — pre-approved framework agreement and privacy guidance.", steps: ["Group → engagement"], approach: "Influence/interest.", output: "Three pairs.", evidence: "Written answer.", excellent: ["Specific mechanisms"], mistakes: ["Generic 'communicate regularly'"], score: "4/4" },
      },
    ],
  },
  solutionFile: {
    kind: "docx",
    lines: [
      "Strategy brief — AI services platform adoption (model solution)",
      "1. Diagnosis: 24 of 60 target entities onboarded (40%). Only 9 of 24 are active monthly (37.5%), i.e. 15% of the target. Activation is the main gap. Barriers among non-active entities: data readiness 58%, skills 46%, procurement 31%, trust and privacy 27%.",
      "2. Initiative A — Data readiness accelerator: templates, data-quality checks and a 6-week readiness sprint per entity. OKR: entities passing the readiness check from 9 to 30 by Q4.",
      "3. Initiative B — Skills programme: role-based training for analysts and product owners plus an entity champion network. OKR: certified champions from 0 to 60 (one per target entity) by Q3; monthly active entities from 9 to 30 by Q4.",
      "4. Initiative C — Procurement and trust pack: pre-approved framework agreement, privacy impact template and published security assurance. OKR: average time from onboarding to first use from 90 to 30 days by Q4.",
      "5. Roadmap: Q1 — readiness assessment of all 60 entities, launch champions; Q2 — readiness sprints for 15 entities, framework agreement live; Q3 — second wave of 15 entities, adoption scorecards to leadership; Q4 — review against OKRs and plan year 2.",
      "6. Risks: competing priorities in entities (mitigation: leadership scorecards); data-sharing concerns (mitigation: privacy pack and clear governance).",
    ],
  },
};

// ------------------------------------------------------------------ 7. Sipchem — Supply Chain Analyst
const ITEMS: [string, number, number, number, number][] = [
  ["Catalyst X", 12, 20, 60, 250],
  ["Valve kit", 3, 30, 30, 80],
  ["Pump seal", 5, 15, 25, 140],
  ["Filter cartridge", 20, 7, 40, 150],
];
const supply: Job = {
  key: "sipchem-supply",
  registry: "ALM-007",
  short: "sipchem",
  field: "Operations & supply chain",
  title_en: "Supply Chain Analyst",
  title_ar: "محلل سلاسل الإمداد",
  department: "Supply Chain",
  category: "engineering",
  level: "junior",
  min_years: 1,
  city: "Al Jubail",
  mode: "onsite",
  salary: [12000, 16000],
  deadline: "2026-12-22",
  description_en: "Department: Supply Chain. Plan inventory for raw materials and critical spares, set reorder points and monitor supplier risk for plant operations. Practice scenario for skills-based hiring on JADARAH.",
  description_ar: "الإدارة: سلاسل الإمداد. تخطيط مخزون المواد الخام وقطع الغيار الحرجة وتحديد نقاط إعادة الطلب ومتابعة مخاطر الموردين لعمليات المصنع. سيناريو تدريبي للتوظيف المبني على المهارات في جدارة.",
  resp_en: ["Set and review reorder points and safety stock", "Monitor stock cover and supplier lead times", "Flag stockout risks to operations", "Propose supplier risk mitigations"],
  resp_ar: ["تحديد نقاط إعادة الطلب ومخزون الأمان ومراجعتها", "متابعة تغطية المخزون ومدد التوريد", "التنبيه لمخاطر نفاد المخزون", "اقتراح معالجات مخاطر الموردين"],
  qual_en: ["Bachelor in Industrial Engineering or Supply Chain", "1+ year in planning or materials", "Advanced Excel"],
  qual_ar: ["بكالوريوس هندسة صناعية أو سلاسل إمداد", "سنة خبرة أو أكثر في التخطيط أو المواد", "Excel متقدم"],
  required: ["Advanced Excel", "Statistics", "Problem Solving"],
  preferred: ["Vendor Management", "Lean Six Sigma"],
  appQuestions: [{ en: "How would you decide the safety stock for a critical spare part?", ar: "كيف تحدد مخزون الأمان لقطعة غيار حرجة؟" }],
  task: {
    title_en: "Reorder point review for critical items",
    title_ar: "مراجعة نقاط إعادة الطلب للمواد الحرجة",
    desc_en: `Item data (fictional): daily use, lead time (days), safety stock, on hand.\n${ITEMS.map((r) => `${r[0]}: ${r[1]}/day, lead time ${r[2]} days, safety stock ${r[3]}, on hand ${r[4]}`).join("\n")}\nReorder point (ROP) = daily use × lead time + safety stock.`,
    desc_ar: `بيانات المواد (افتراضية): الاستهلاك اليومي، مدة التوريد (أيام)، مخزون الأمان، الرصيد الحالي.\n${ITEMS.map((r) => `${r[0]}: ${r[1]} يوميًا، مدة التوريد ${r[2]} يومًا، مخزون الأمان ${r[3]}، الرصيد ${r[4]}`).join("\n")}\nنقطة إعادة الطلب = الاستهلاك اليومي × مدة التوريد + مخزون الأمان.`,
    minutes: 60,
    difficulty: "intermediate",
    questions: [
      {
        type: "multiple_choice",
        points: 2,
        en: "What is the reorder point for Catalyst X?",
        ar: "ما نقطة إعادة الطلب للمحفز X؟",
        options: [{ en: "300 units", ar: "300 وحدة", correct: true }, { en: "240 units", ar: "240 وحدة" }, { en: "250 units", ar: "250 وحدة" }, { en: "60 units", ar: "60 وحدة" }],
        solution: { model: "Option 1: 12 × 20 + 60 = 300.", steps: ["ROP formula"], approach: "Formula.", output: "300", calc: "12×20+60 = 300", evidence: "Selected option.", excellent: ["Correct"], mistakes: ["Forgetting safety stock (240)"], score: "2/2 (automatic)" },
      },
      {
        type: "case_study",
        points: 6,
        en: "Question 2 — Reorder decisions\n\nFor each item state whether to reorder now and how urgent it is, using ROP and days of cover.",
        ar: "السؤال 2 — قرارات إعادة الطلب\n\nحدد لكل مادة هل يجب إعادة الطلب الآن ومدى الإلحاح باستخدام نقطة إعادة الطلب وأيام التغطية.",
        criteria: [
          crit("rop", "Correct ROPs", "نقاط صحيحة", 2, "Catalyst 300, Valve 120, Pump seal 100, Filter 180"),
          crit("decisions", "Correct decisions", "قرارات صحيحة", 2, "reorder Catalyst, Valve, Filter; Pump seal OK"),
          crit("urgency", "Urgency via days of cover", "الإلحاح بأيام التغطية", 2, "Valve kit 26.7 days cover < 30-day lead time → expedite; Filter 7.5 days ≈ lead time 7"),
        ],
        solution: { model: "Catalyst X: ROP 300 > on hand 250 → reorder now (cover 20.8 days vs 20-day lead time, tight). Valve kit: ROP 120 > 80 → reorder and EXPEDITE: cover 26.7 days is shorter than the 30-day lead time, so stock runs out before a normal order arrives. Pump seal: ROP 100 < 140 → no order. Filter cartridge: ROP 180 > 150 → reorder now (cover 7.5 days vs 7-day lead time).", steps: ["ROP per item", "Compare with on hand", "Days of cover = on hand ÷ daily use", "Compare cover with lead time"], approach: "ROP + cover vs lead time.", output: "Reorder 3 items; Valve kit most urgent.", calc: "Covers: 250/12 = 20.8; 80/3 = 26.7; 140/5 = 28; 150/20 = 7.5.", evidence: "Written answer.", excellent: ["Identifies Valve kit stockout risk"], mistakes: ["Treating all reorders as equally urgent"], score: "6/6" },
      },
      {
        type: "file_upload",
        points: 8,
        en: "Question 3 — Reorder workbook (XLSX)\n\nBuild a workbook with ROP, days of cover, a reorder flag and an urgency flag (cover < lead time) using formulas, plus suggested order quantities.",
        ar: "السؤال 3 — مصنف إعادة الطلب (XLSX)\n\nأنشئ مصنفًا بنقطة إعادة الطلب وأيام التغطية ومؤشر إعادة الطلب ومؤشر الإلحاح (التغطية أقل من مدة التوريد) بالمعادلات، مع كميات الطلب المقترحة.",
        deliverable: { name: "reorder_review.xlsx", format: "XLSX", description: "ROP, cover, reorder and urgency flags with formulas" },
        criteria: [
          crit("formulas", "ROP and cover formulas", "معادلات النقطة والتغطية", 3, "formulas reference the input cells"),
          crit("flags", "Reorder and urgency flags", "مؤشرات الطلب والإلحاح", 3, "correct flags; Valve kit urgent"),
          crit("quantities", "Order quantities justified", "كميات مبررة", 2, "e.g. order up to ROP + lead-time demand"),
        ],
        solution: { model: "See reorder_review_solution.xlsx (order quantity = ROP + daily use × lead time − on hand).", steps: ["Inputs", "ROP", "Cover", "Flags", "Quantity"], approach: "Formula-driven.", output: "XLSX.", calc: "Catalyst 300+240−250 = 290; Valve 120+90−80 = 130; Filter 180+140−150 = 170.", evidence: "reorder_review.xlsx", excellent: ["Formulas", "Urgency flag"], mistakes: ["Typed results"], score: "8/8" },
      },
      {
        type: "short_answer",
        points: 4,
        en: "Question 4 — Supplier risk\n\nGive two mitigations for the Valve kit's 30-day lead time.",
        ar: "السؤال 4 — مخاطر المورد\n\nاقترح معالجتين لمدة توريد مجموعة الصمامات البالغة 30 يومًا.",
        criteria: [crit("mitigations", "Relevant mitigations", "معالجات ملائمة", 2, "second qualified supplier, consignment/vendor-managed stock, higher safety stock"), crit("specific", "Specific and measurable", "محددة وقابلة للقياس", 2, "states the new lead time or stock level")],
        solution: { model: "1) Qualify a second local supplier with a 10-day lead time for urgent orders. 2) Raise safety stock to 45 units (15 days) until the lead time falls, or agree consignment stock at site.", steps: ["Reduce lead time", "Buffer"], approach: "Dual sourcing + buffer.", output: "Two mitigations.", evidence: "Written answer.", excellent: ["Numbers"], mistakes: ["'Monitor the supplier' only"], score: "4/4" },
      },
    ],
  },
  solutionFile: {
    kind: "xlsx",
    sheets: [
      {
        name: "Reorder",
        rows: [
          ["Item", "Daily use", "Lead time", "Safety stock", "On hand", "ROP", "Days of cover", "Reorder?", "Urgent?", "Order qty"],
          ...ITEMS.map((r, i): Cell[] => {
            const n = i + 2;
            const rop = r[1] * r[2] + r[3];
            const cover = Math.round((r[4] / r[1]) * 100) / 100;
            return [r[0], r[1], r[2], r[3], r[4], { f: `B${n}*C${n}+D${n}`, v: rop }, { f: `E${n}/B${n}`, v: cover }, { f: `IF(E${n}<F${n},"Yes","No")`, v: r[4] < rop ? "Yes" : "No" }, { f: `IF(G${n}<C${n},"Expedite","No")`, v: cover < r[2] ? "Expedite" : "No" }, { f: `IF(H${n}="Yes",F${n}+B${n}*C${n}-E${n},0)`, v: r[4] < rop ? rop + r[1] * r[2] - r[4] : 0 }];
          }),
        ],
      },
    ],
  },
};

// ------------------------------------------------------------------ 8. Saudi Red Sea Authority — Operations Specialist
const STEPS: [string, number, string][] = [
  ["Application intake", 1, ""],
  ["Document check", 4, "35% of files returned for missing documents"],
  ["Environmental review", 9, ""],
  ["Safety inspection", 6, "4 of the 6 days are waiting for an inspector"],
  ["Fee payment", 2, "manual bank transfer"],
  ["Permit issue", 1, ""],
];
const ops: Job = {
  key: "srsa-ops",
  registry: "ALM-008",
  short: "srsa",
  field: "Operations & supply chain",
  title_en: "Operations Specialist — Marine Licensing",
  title_ar: "أخصائي عمليات — التراخيص البحرية",
  department: "Marine Operations",
  category: "public-sector",
  level: "mid",
  min_years: 2,
  city: "Jeddah",
  mode: "onsite",
  salary: [13000, 17000],
  deadline: "2026-12-28",
  description_en: "Department: Marine Operations. Improve licensing processes for coastal tourism activities, track turnaround times and coordinate with inspectors and operators. Practice scenario for skills-based hiring on JADARAH.",
  description_ar: "الإدارة: العمليات البحرية. تحسين إجراءات تراخيص أنشطة السياحة الساحلية ومتابعة أزمنة الإنجاز والتنسيق مع المفتشين والمشغلين. سيناريو تدريبي للتوظيف المبني على المهارات في جدارة.",
  resp_en: ["Map and improve licensing processes", "Monitor turnaround and rework KPIs", "Coordinate inspections and reviews", "Report improvements to management"],
  resp_ar: ["توثيق إجراءات الترخيص وتحسينها", "متابعة مؤشرات زمن الإنجاز وإعادة العمل", "تنسيق الفحوص والمراجعات", "رفع التحسينات للإدارة"],
  qual_en: ["Bachelor in Marine Sciences, Engineering or Business", "2+ years in operations", "Process mapping (BPMN)"],
  qual_ar: ["بكالوريوس علوم بحرية أو هندسة أو إدارة", "سنتان خبرة أو أكثر في العمليات", "رسم الإجراءات (BPMN)"],
  required: ["Process Modeling (BPMN)", "Root Cause Analysis", "Stakeholder Management"],
  preferred: ["Regulatory Compliance"],
  appQuestions: [{ en: "Describe a process you shortened and how you measured the result.", ar: "صف إجراءً قمت باختصاره وكيف قست النتيجة." }],
  task: {
    title_en: "Berth permit process improvement",
    title_ar: "تحسين إجراء تصريح المرسى",
    desc_en: `Current yacht berth permit process (fictional), average days per step:\n${STEPS.map((s) => `${s[0]}: ${s[1]} days${s[2] ? ` (${s[2]})` : ""}`).join("\n")}\nTotal: ${STEPS.reduce((a, s) => a + s[1], 0)} days. Target: 10 days. Steps run one after another today.`,
    desc_ar: `إجراء تصريح مرسى اليخوت الحالي (افتراضي)، متوسط الأيام لكل خطوة:\n${STEPS.map((s) => `${s[0]}: ${s[1]} يوم`).join("\n")}\nملاحظات: 35% من الملفات تعاد لنقص المستندات؛ 4 من 6 أيام الفحص انتظار لمفتش؛ الدفع بتحويل بنكي يدوي. الإجمالي ${STEPS.reduce((a, s) => a + s[1], 0)} يومًا والمستهدف 10 أيام، والخطوات متتابعة حاليًا.`,
    minutes: 60,
    difficulty: "intermediate",
    questions: [
      {
        type: "multiple_choice",
        points: 2,
        en: "Which step is the main bottleneck?",
        ar: "ما الخطوة التي تمثل عنق الزجاجة الرئيسي؟",
        options: [{ en: "Environmental review (9 days, 39% of the total)", ar: "المراجعة البيئية (9 أيام، 39% من الإجمالي)", correct: true }, { en: "Application intake", ar: "استلام الطلب" }, { en: "Permit issue", ar: "إصدار التصريح" }, { en: "Fee payment", ar: "سداد الرسوم" }],
        solution: { model: "Option 1: 9 of 23 days = 39%.", steps: ["Longest step"], approach: "Bottleneck = longest constraint.", output: "Option 1.", calc: "9/23 = 39.1%", evidence: "Selected option.", excellent: ["Correct"], mistakes: ["Picking a short step"], score: "2/2 (automatic)" },
      },
      {
        type: "case_study",
        points: 6,
        en: "Question 2 — Root causes\n\nIdentify the three biggest sources of delay and their root causes, with the days each contributes.",
        ar: "السؤال 2 — الأسباب الجذرية\n\nحدد أكبر ثلاثة مصادر للتأخير وأسبابها الجذرية مع عدد الأيام لكل منها.",
        criteria: [
          crit("sources", "Delay sources", "مصادر التأخير", 2, "environmental review 9 d, inspection waiting 4 d, document rework (35%)"),
          crit("causes", "Root causes", "الأسباب الجذرية", 2, "sequential steps, inspector capacity, incomplete submissions/no checklist"),
          crit("quantified", "Quantified", "قياس كمي", 2, "days and percentages used"),
        ],
        solution: { model: "1) Environmental review — 9 days (39%), run in sequence after the document check although it only needs the vessel and site data. 2) Inspection waiting — 4 of 6 days are queue time: inspector capacity/scheduling. 3) Document rework — 35% of files are returned, adding repeat checks; cause: no applicant checklist or online validation. Also manual payment adds 2 days.", steps: ["Rank by days", "Separate work time from waiting", "Explain cause"], approach: "Time analysis + 5 whys.", output: "Three causes with days.", evidence: "Written answer.", excellent: ["Separates queue from work"], mistakes: ["Listing steps without causes"], score: "6/6" },
      },
      {
        type: "file_upload",
        points: 8,
        en: "Question 3 — To-be process (DOCX)\n\nPropose the improved process: changes per step, which steps run in parallel, the expected total days (show the calculation) and KPIs.",
        ar: "السؤال 3 — الإجراء المستهدف (DOCX)\n\nاقترح الإجراء المحسّن: التغييرات لكل خطوة، والخطوات المتوازية، والأيام المتوقعة (مع الحساب)، والمؤشرات.",
        deliverable: { name: "to_be_process.docx", format: "DOCX", description: "Improved process, parallel steps, expected days and KPIs" },
        criteria: [
          crit("changes", "Step changes", "تغييرات الخطوات", 3, "online checklist/validation, inspection booking, e-payment"),
          crit("parallel", "Parallelisation and calculation", "التوازي والحساب", 3, "environmental review in parallel with inspection; critical path computed ≤ 10 days"),
          crit("kpis", "KPIs", "المؤشرات", 2, "turnaround, rework rate, inspection wait"),
        ],
        solution: { model: "See to_be_process_solution.docx (critical path 1 + 2 + max(6, 2) + 0.5 + 0.5 = 10 days).", steps: ["Fix rework", "Parallel review and inspection", "E-payment", "Compute critical path"], approach: "Lean process redesign.", output: "DOCX.", calc: "Intake 1 + document check 2 + max(environmental 6, inspection 2) + payment 0.5 + issue 0.5 = 10 days.", evidence: "to_be_process.docx", excellent: ["Critical path shown"], mistakes: ["Adding days of parallel steps"], score: "8/8" },
      },
      {
        type: "short_answer",
        points: 4,
        en: "Question 4 — KPIs\n\nList three KPIs with targets to monitor the new process.",
        ar: "السؤال 4 — المؤشرات\n\nاذكر ثلاثة مؤشرات بمستهدفات لمتابعة الإجراء الجديد.",
        criteria: [crit("kpis", "Relevant KPIs", "مؤشرات ملائمة", 2, "turnaround, rework, inspection wait"), crit("targets", "Targets", "المستهدفات", 2, "numeric targets")],
        solution: { model: "Average turnaround ≤ 10 days; document rework rate ≤ 10%; inspection wait ≤ 1 day.", steps: ["KPI + target"], approach: "Outcome and driver KPIs.", output: "Three KPIs.", evidence: "Written answer.", excellent: ["Numbers"], mistakes: ["No targets"], score: "4/4" },
      },
    ],
  },
  solutionFile: {
    kind: "docx",
    lines: [
      "Berth permit — to-be process (model solution)",
      "Current: 23 days in sequence (intake 1, document check 4, environmental review 9, inspection 6, payment 2, issue 1). Target 10 days.",
      "Change 1 — Online application with mandatory fields and document checklist; automatic completeness validation. Document check 4 → 2 days; rework 35% → ≤10%.",
      "Change 2 — Environmental review starts as soon as the application is complete and runs IN PARALLEL with the safety inspection. Standard-case template for small yachts: 9 → 6 days.",
      "Change 3 — Inspection booking calendar at submission; inspector pool shared between marinas. Inspection 6 → 2 days (removes 4 days of waiting).",
      "Change 4 — Electronic payment at approval: 2 → 0.5 day. Automatic permit issue: 1 → 0.5 day.",
      "Critical path: intake 1 + document check 2 + max(environmental 6, inspection 2) + payment 0.5 + issue 0.5 = 10 days.",
      "KPIs: average turnaround ≤ 10 days; % of permits within 10 days ≥ 85%; document rework ≤ 10%; inspection wait ≤ 1 day; applicant satisfaction ≥ 4/5.",
      "Owners: Licensing (intake and checks), Environment team, Inspection unit, Finance (e-payment). Review monthly.",
    ],
  },
};

// ------------------------------------------------------------------ 9. Ministry of Finance — Budget Analyst
const PROGRAMS: [string, number, number][] = [
  ["Digital services", 120, 138],
  ["Infrastructure maintenance", 300, 255],
  ["Training", 45, 47],
  ["Grants", 200, 160],
];
const budget: Job = {
  key: "mof-budget",
  registry: "ALM-009",
  short: "mof",
  field: "Finance & accounting",
  title_en: "Budget Analyst",
  title_ar: "محلل ميزانية",
  department: "Budget Planning",
  category: "finance",
  level: "junior",
  min_years: 1,
  city: "Riyadh",
  mode: "onsite",
  salary: [12000, 16000],
  deadline: "2026-12-20",
  description_en: "Department: Budget Planning. Monitor program spending against budget, analyse variances and prepare reallocation recommendations. Practice scenario for skills-based hiring on JADARAH.",
  description_ar: "الإدارة: تخطيط الميزانية. متابعة صرف البرامج مقارنة بالميزانية وتحليل الانحرافات وإعداد توصيات إعادة التخصيص. سيناريو تدريبي للتوظيف المبني على المهارات في جدارة.",
  resp_en: ["Prepare budget-versus-actual reports", "Explain variances and their causes", "Recommend reallocations", "Support the annual budget cycle"],
  resp_ar: ["إعداد تقارير الميزانية مقابل الفعلي", "تفسير الانحرافات وأسبابها", "التوصية بإعادة التخصيص", "دعم دورة الميزانية السنوية"],
  qual_en: ["Bachelor in Finance, Accounting or Economics", "1+ year in financial planning", "Advanced Excel"],
  qual_ar: ["بكالوريوس مالية أو محاسبة أو اقتصاد", "سنة خبرة أو أكثر في التخطيط المالي", "Excel متقدم"],
  required: ["Budgeting & Forecasting", "Financial Analysis", "Advanced Excel"],
  preferred: ["Power BI"],
  appQuestions: [{ en: "How do you explain a budget variance to a non-finance manager?", ar: "كيف تشرح انحراف الميزانية لمدير غير مالي؟" }],
  task: {
    title_en: "Quarterly budget variance review",
    title_ar: "مراجعة انحرافات الميزانية الربعية",
    desc_en: `Quarterly budget vs actual spending (fictional, SAR millions):\n${PROGRAMS.map((p) => `${p[0]}: budget ${p[1]}, actual ${p[2]}`).join("\n")}\nPolicy: variances beyond ±10% must be explained to leadership.`,
    desc_ar: `الميزانية مقابل الصرف الفعلي للربع (افتراضي، بملايين الريالات):\n${PROGRAMS.map((p) => `${p[0]}: الميزانية ${p[1]}، الفعلي ${p[2]}`).join("\n")}\nالسياسة: يجب تفسير الانحرافات التي تتجاوز ±10% للقيادة.`,
    minutes: 60,
    difficulty: "intermediate",
    questions: [
      {
        type: "multiple_choice",
        points: 2,
        en: "For an expenditure line, actual spending below budget is a:",
        ar: "في بند مصروفات، الصرف الفعلي الأقل من الميزانية يُعد:",
        options: [{ en: "Favourable variance (but check for delays)", ar: "انحرافًا إيجابيًا (مع التحقق من التأخير)", correct: true }, { en: "Unfavourable variance", ar: "انحرافًا سلبيًا" }, { en: "Not a variance", ar: "ليس انحرافًا" }, { en: "Revenue gain", ar: "مكسب إيرادات" }],
        solution: { model: "Option 1.", steps: ["Definition"], approach: "Definition.", output: "Option 1.", evidence: "Selected option.", excellent: ["Correct"], mistakes: ["Calling underspend unfavourable"], score: "2/2 (automatic)" },
      },
      {
        type: "case_study",
        points: 6,
        en: "Question 2 — Variance commentary\n\nCompute each variance (SAR m and %), flag those beyond ±10%, and explain what leadership should ask about each flagged line.",
        ar: "السؤال 2 — تعليق الانحرافات\n\nاحسب كل انحراف (بالمليون وبالنسبة) وحدد ما يتجاوز ±10% ووضح ما يجب أن تسأل عنه القيادة لكل بند.",
        criteria: [
          crit("calc", "Correct variances", "انحرافات صحيحة", 2, "Digital +18 (+15.0%), Infrastructure −45 (−15.0%), Training +2 (+4.4%), Grants −40 (−20.0%), total −65 (−9.8%)"),
          crit("flags", "Correct flags", "تحديد صحيح", 2, "Digital, Infrastructure and Grants flagged; Training not"),
          crit("questions", "Leadership questions", "أسئلة القيادة", 2, "overspend driver for Digital; timing vs saving for Infrastructure and Grants"),
        ],
        solution: { model: "Digital +18 m (+15.0%) overspend — what drove it (new services, licences) and will it continue? Infrastructure −45 m (−15.0%) underspend — is it a delay in maintenance contracts (timing) or a real saving? Grants −40 m (−20.0%) underspend — are disbursements delayed, and are beneficiaries affected? Training +2 m (+4.4%) within tolerance. Total −65 m (−9.8%) underspend.", steps: ["Variance = actual − budget", "% of budget", "Apply ±10%", "Questions"], approach: "Variance analysis.", output: "Three flagged lines.", calc: "18/120 = 15.0%; −45/300 = −15.0%; 2/45 = 4.4%; −40/200 = −20.0%; −65/665 = −9.8%.", evidence: "Written answer.", excellent: ["Distinguishes timing from savings"], mistakes: ["Sign errors", "Flagging Training"], score: "6/6" },
      },
      {
        type: "file_upload",
        points: 8,
        en: "Question 3 — Variance workbook (XLSX)\n\nBuild a workbook with variance, variance %, a ±10% flag and totals using formulas, plus a commentary column.",
        ar: "السؤال 3 — مصنف الانحرافات (XLSX)\n\nأنشئ مصنفًا بالانحراف ونسبته ومؤشر ±10% والإجماليات بالمعادلات، مع عمود للتعليق.",
        deliverable: { name: "budget_variance.xlsx", format: "XLSX", description: "Variance, %, ±10% flag, totals and commentary" },
        criteria: [
          crit("formulas", "Variance formulas", "معادلات الانحراف", 3, "variance and % as formulas, including totals"),
          crit("flags", "Threshold flags", "مؤشرات الحد", 3, "ABS(%)>10 flag correct for all lines"),
          crit("commentary", "Commentary", "التعليق", 2, "commentary for each flagged line"),
        ],
        solution: { model: "See budget_variance_solution.xlsx.", steps: ["Inputs", "Variance", "%", "Flag", "Totals", "Commentary"], approach: "Formula-driven.", output: "XLSX.", evidence: "budget_variance.xlsx", excellent: ["ABS in flag", "Totals"], mistakes: ["% of actual instead of budget"], score: "8/8" },
      },
      {
        type: "short_answer",
        points: 4,
        en: "Question 4 — Reallocation\n\nRecommend whether to reallocate funds for the next quarter and with what safeguard.",
        ar: "السؤال 4 — إعادة التخصيص\n\nأوصِ بشأن إعادة تخصيص الأموال للربع القادم مع الضمانات اللازمة.",
        criteria: [crit("recommendation", "Recommendation", "التوصية", 2, "partial reallocation to Digital from confirmed savings only"), crit("safeguard", "Safeguard", "الضمانة", 2, "confirm timing of Infrastructure/Grants spend before moving funds")],
        solution: { model: "Cover the Digital overspend (≈18 m) from confirmed savings only after Infrastructure and Grants owners confirm whether their underspend is permanent; if it is timing, keep the funds and review Digital's forecast.", steps: ["Confirm nature of underspend", "Reallocate confirmed amount"], approach: "Prudent reallocation.", output: "Conditional recommendation.", evidence: "Written answer.", excellent: ["Safeguard stated"], mistakes: ["Moving all 85 m immediately"], score: "4/4" },
      },
    ],
  },
  solutionFile: {
    kind: "xlsx",
    sheets: [
      {
        name: "Variance",
        rows: [
          ["Program", "Budget (SAR m)", "Actual (SAR m)", "Variance", "Variance %", "Beyond ±10%?", "Commentary"],
          ...PROGRAMS.map((p, i): Cell[] => {
            const n = i + 2;
            const v = p[2] - p[1];
            return [p[0], p[1], p[2], { f: `C${n}-B${n}`, v }, { f: `D${n}/B${n}*100`, v: pct(v, p[1]) }, { f: `IF(ABS(E${n})>10,"Yes","No")`, v: Math.abs(v / p[1]) > 0.1 ? "Yes" : "No" }, Math.abs(v / p[1]) > 0.1 ? (v > 0 ? "Overspend: confirm drivers and forecast" : "Underspend: confirm timing vs saving") : "Within tolerance"];
          }),
          ["Total", { f: "SUM(B2:B5)", v: 665 }, { f: "SUM(C2:C5)", v: 600 }, { f: "C6-B6", v: -65 }, { f: "D6/B6*100", v: -9.77 }, { f: 'IF(ABS(E6)>10,"Yes","No")', v: "No" }, "Net underspend 9.8%"],
        ],
      },
    ],
  },
};

// ------------------------------------------------------------------ 10. SIDF — Internal Audit Associate
const LOANS: [string, number, string, number, string, string][] = [
  ["L-101", 3.2, "Manager", 3.2, "2026-02-03", "2026-02-01"],
  ["L-102", 6.5, "Manager", 6.5, "2026-02-10", "2026-02-08"],
  ["L-103", 4.8, "Committee", 4.8, "2026-02-17", "2026-02-12"],
  ["L-104", 7.1, "Committee", 6.6, "2026-02-24", "2026-02-20"],
  ["L-105", 2.0, "Manager", 2.0, "2026-03-02", "2026-03-05"],
  ["L-106", 5.4, "Committee", 5.4, "2026-03-09", "2026-03-04"],
  ["L-107", 1.1, "Manager", 1.1, "2026-03-16", "2026-03-12"],
  ["L-108", 9.0, "Manager", 9.0, "2026-03-23", "2026-03-18"],
];
const audit: Job = {
  key: "sidf-audit",
  registry: "ALM-010",
  short: "sidf",
  field: "Finance & accounting",
  title_en: "Internal Audit Associate",
  title_ar: "مساعد مراجعة داخلية",
  department: "Internal Audit",
  category: "finance",
  level: "junior",
  min_years: 1,
  city: "Riyadh",
  mode: "onsite",
  salary: [12000, 16000],
  deadline: "2026-12-24",
  description_en: "Department: Internal Audit. Test financing controls, document exceptions and write clear audit findings with practical recommendations. Practice scenario for skills-based hiring on JADARAH.",
  description_ar: "الإدارة: المراجعة الداخلية. اختبار ضوابط التمويل وتوثيق الاستثناءات وكتابة ملاحظات مراجعة واضحة بتوصيات عملية. سيناريو تدريبي للتوظيف المبني على المهارات في جدارة.",
  resp_en: ["Test approval and disbursement controls", "Document exceptions and their impact", "Draft findings and recommendations", "Follow up management actions"],
  resp_ar: ["اختبار ضوابط الاعتماد والصرف", "توثيق الاستثناءات وأثرها", "صياغة الملاحظات والتوصيات", "متابعة إجراءات الإدارة"],
  qual_en: ["Bachelor in Accounting or Finance", "1+ year in audit", "SOCPA/CIA progress is a plus"],
  qual_ar: ["بكالوريوس محاسبة أو مالية", "سنة خبرة أو أكثر في المراجعة", "التقدم في SOCPA أو CIA ميزة"],
  required: ["Risk Assessment", "IFRS Accounting", "Advanced Excel"],
  preferred: ["Regulatory Compliance"],
  appQuestions: [{ en: "Describe an exception you found during testing and how you reported it.", ar: "صف استثناءً اكتشفته أثناء الاختبار وكيف أبلغت عنه." }],
  task: {
    title_en: "Loan disbursement controls testing",
    title_ar: "اختبار ضوابط صرف القروض",
    desc_en:
      "Control criteria (fictional): (1) disbursements above SAR 5 million require Credit Committee approval; (2) the disbursed amount must equal the supplier invoice; (3) disbursement must not precede the approval date.\nSample (amount and invoice in SAR millions; approval date, disbursement date):\n" +
      LOANS.map((l) => `${l[0]}: amount ${l[1]}, approved by ${l[2]}, invoice ${l[3]}, approval ${l[5]}, disbursed ${l[4]}`).join("\n"),
    desc_ar:
      "معايير الضبط (افتراضية): (1) الصرف فوق 5 ملايين ريال يتطلب اعتماد لجنة الائتمان؛ (2) يجب أن يساوي المبلغ المصروف فاتورة المورد؛ (3) لا يسبق الصرف تاريخ الاعتماد.\nالعينة (المبلغ والفاتورة بالملايين؛ تاريخ الاعتماد وتاريخ الصرف):\n" +
      LOANS.map((l) => `${l[0]}: المبلغ ${l[1]}، الاعتماد ${l[2] === "Manager" ? "المدير" : "اللجنة"}، الفاتورة ${l[3]}، الاعتماد ${l[5]}، الصرف ${l[4]}`).join("\n"),
    minutes: 60,
    difficulty: "intermediate",
    questions: [
      {
        type: "multiple_choice",
        points: 2,
        en: "Which of these is a preventive control?",
        ar: "أي مما يلي ضابط وقائي؟",
        options: [{ en: "System blocks disbursement until the required approval is recorded", ar: "يمنع النظام الصرف حتى تسجيل الاعتماد المطلوب", correct: true }, { en: "Monthly review of disbursements already made", ar: "مراجعة شهرية للمصروفات المنفذة" }, { en: "Annual external audit", ar: "المراجعة الخارجية السنوية" }, { en: "Exception report after month end", ar: "تقرير استثناءات بعد نهاية الشهر" }],
        solution: { model: "Option 1 — it stops the error before it happens.", steps: ["Preventive vs detective"], approach: "Definition.", output: "Option 1.", evidence: "Selected option.", excellent: ["Correct"], mistakes: ["Choosing a detective review"], score: "2/2 (automatic)" },
      },
      {
        type: "case_study",
        points: 6,
        en: "Question 2 — Exceptions\n\nTest each loan against the three criteria. List the exceptions, the exception rate by count and by value, and a risk rating with reasons.",
        ar: "السؤال 2 — الاستثناءات\n\nاختبر كل قرض وفق المعايير الثلاثة، واذكر الاستثناءات ونسبتها عددًا وقيمة وتصنيف المخاطر مع الأسباب.",
        criteria: [
          crit("exceptions", "All exceptions found", "تحديد كل الاستثناءات", 2, "L-102 and L-108 approval level; L-104 invoice mismatch; L-105 disbursed before approval"),
          crit("rates", "Correct rates", "نسب صحيحة", 2, "4 of 8 = 50%; value 24.6 of 39.1 = 62.9%"),
          crit("rating", "Risk rating", "تصنيف المخاطر", 2, "high: large unapproved disbursements (15.5 m without committee) and overpayment of 0.5 m"),
        ],
        solution: { model: "Exceptions: L-102 (6.5 m) and L-108 (9.0 m) approved only by a manager although above 5 m — criterion 1; L-104 disbursed 7.1 m against a 6.6 m invoice — 0.5 m overpayment — criterion 2; L-105 disbursed on 2 March before approval on 5 March — criterion 3. Count rate 4/8 = 50%; value rate 24.6/39.1 = 62.9%. Rating: HIGH — 15.5 m disbursed without the required committee approval and a 0.5 m overpayment indicate the approval control can be bypassed.", steps: ["Test criterion 1", "Test criterion 2", "Test criterion 3", "Rates", "Rate risk"], approach: "Attribute testing.", output: "Four exceptions, 50% / 62.9%, high risk.", calc: "Total sample 39.1 m; exceptions 6.5 + 7.1 + 2.0 + 9.0 = 24.6 m.", evidence: "Written answer.", excellent: ["All four with criteria", "Both rates"], mistakes: ["Missing the date exception L-105", "Counting L-104 as approval exception"], score: "6/6" },
      },
      {
        type: "file_upload",
        points: 8,
        en: "Question 3 — Testing workbook (XLSX)\n\nBuild a workbook testing each attribute with formulas (pass/fail per criterion and an exception flag) and a summary of counts, values and rates.",
        ar: "السؤال 3 — مصنف الاختبار (XLSX)\n\nأنشئ مصنفًا يختبر كل معيار بالمعادلات (نجاح/إخفاق لكل معيار ومؤشر استثناء) مع ملخص للأعداد والقيم والنسب.",
        deliverable: { name: "controls_testing.xlsx", format: "XLSX", description: "Attribute tests with formulas and a summary" },
        criteria: [
          crit("tests", "Attribute formulas", "معادلات الاختبار", 3, "one formula per criterion referencing cells"),
          crit("summary", "Summary correct", "ملخص صحيح", 3, "4 exceptions, 50%, 24.6 m, 62.9%"),
          crit("documentation", "Documentation", "التوثيق", 2, "criteria stated and exceptions explained"),
        ],
        solution: { model: "See controls_testing_solution.xlsx.", steps: ["Inputs", "Three tests", "Flag", "Summary"], approach: "Formula-driven testing.", output: "XLSX.", evidence: "controls_testing.xlsx", excellent: ["Date test with real dates"], mistakes: ["Typed Pass/Fail"], score: "8/8" },
      },
      {
        type: "short_answer",
        points: 4,
        en: "Question 4 — Audit finding\n\nWrite one finding in condition, criteria, cause, effect and recommendation format.",
        ar: "السؤال 4 — ملاحظة المراجعة\n\nاكتب ملاحظة واحدة بصيغة: الوضع، المعيار، السبب، الأثر، التوصية.",
        criteria: [crit("format", "All five elements", "العناصر الخمسة", 2, "condition, criteria, cause, effect, recommendation"), crit("specific", "Specific and evidenced", "محددة ومدعمة", 2, "cites loans and amounts")],
        solution: { model: "Condition: L-102 (6.5 m) and L-108 (9.0 m) were disbursed with manager approval only. Criteria: disbursements above 5 m require Credit Committee approval. Cause: the system does not enforce approval levels by amount. Effect: 15.5 m disbursed without the required oversight. Recommendation: configure system approval limits and review both loans retrospectively with the committee.", steps: ["Five elements"], approach: "Standard finding format.", output: "One finding.", evidence: "Written answer.", excellent: ["Amounts cited"], mistakes: ["Missing cause"], score: "4/4" },
      },
    ],
  },
  solutionFile: {
    kind: "xlsx",
    sheets: [
      {
        name: "Testing",
        rows: [
          ["Loan", "Amount (SAR m)", "Approved by", "Invoice (SAR m)", "Disbursed", "Approved", "C1 approval level", "C2 invoice match", "C3 date order", "Exception?"],
          ...LOANS.map((l, i): Cell[] => {
            const n = i + 2;
            const c1 = l[1] <= 5 || l[2] === "Committee" ? "Pass" : "Fail";
            const c2 = l[1] === l[3] ? "Pass" : "Fail";
            const c3 = l[4] >= l[5] ? "Pass" : "Fail";
            return [l[0], l[1], l[2], l[3], l[4], l[5], { f: `IF(OR(B${n}<=5,C${n}="Committee"),"Pass","Fail")`, v: c1 }, { f: `IF(B${n}=D${n},"Pass","Fail")`, v: c2 }, { f: `IF(DATEVALUE(E${n})>=DATEVALUE(F${n}),"Pass","Fail")`, v: c3 }, { f: `IF(COUNTIF(G${n}:I${n},"Fail")>0,"Yes","No")`, v: [c1, c2, c3].includes("Fail") ? "Yes" : "No" }];
          }),
          [],
          ["Summary"],
          ["Exceptions (count)", { f: 'COUNTIF(J2:J9,"Yes")', v: 4 }],
          ["Exception rate by count %", { f: "B12/COUNTA(A2:A9)*100", v: 50 }],
          ["Exception value (SAR m)", { f: 'SUMIF(J2:J9,"Yes",B2:B9)', v: 24.6 }],
          ["Sample value (SAR m)", { f: "SUM(B2:B9)", v: 39.1 }],
          ["Exception rate by value %", { f: "B14/B15*100", v: 62.92 }],
        ],
      },
    ],
  },
};

export const JOBS: Job[] = [legal, pr, ta, procurement, cx, strategy, supply, ops, budget, audit];
