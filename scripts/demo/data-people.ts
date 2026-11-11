/* Fictional people. Names are generic and not intended to depict any real person. */

// name, archetype role key (for skills), years, city, gender-neutral not needed
export const CANDIDATES: [string, string, number, string][] = [
  ["سارة القحطاني", "data-analyst", 1, "Riyadh"],
  ["عبدالله الحربي", "fullstack", 3, "Riyadh"],
  ["نورة العتيبي", "junior-dev", 0, "Jeddah"],
  ["فهد الدوسري", "backend", 5, "Riyadh"],
  ["ريم الشهري", "ux-designer", 2, "Jeddah"],
  ["خالد الغامدي", "soc-analyst", 1, "Dammam"],
  ["لمى الزهراني", "ai-engineer", 2, "Riyadh"],
  ["محمد السبيعي", "cloud-engineer", 4, "Riyadh"],
  ["هيا المطيري", "business-analyst", 1, "Riyadh"],
  ["تركي العنزي", "data-engineer", 3, "Dhahran"],
  ["جود الشمري", "data-scientist", 2, "Riyadh"],
  ["ياسر البقمي", "appsec", 6, "Riyadh"],
  ["دانة الرشيد", "product-manager", 4, "Jeddah"],
  ["عمر الجهني", "ml-engineer", 3, "Riyadh"],
  ["أسماء الحارثي", "data-analyst", 0, "Dammam"],
  ["بندر القرني", "pm-delivery", 7, "Riyadh"],
  ["رهف العمري", "junior-dev", 0, "Riyadh"],
  ["سلطان الشهراني", "fullstack", 2, "Jeddah"],
  ["مها اليامي", "business-analyst", 3, "Riyadh"],
  ["نايف المالكي", "soc-analyst", 2, "Riyadh"],
  ["غادة السهلي", "ux-designer", 4, "Riyadh"],
  ["ماجد الأحمدي", "data-engineer", 1, "Jeddah"],
  ["شهد الخالدي", "ai-engineer", 1, "Riyadh"],
  ["إبراهيم الفيفي", "cloud-engineer", 2, "Dammam"],
  ["لجين القرشي", "data-scientist", 0, "Jeddah"],
  ["راكان الزهراني", "backend", 2, "Riyadh"],
  ["العنود الدخيل", "product-manager", 2, "Riyadh"],
  ["حسن العسيري", "ml-engineer", 5, "Dhahran"],
  ["وعد الصاعدي", "data-analyst", 2, "Jeddah"],
  ["زياد الرويلي", "appsec", 3, "Riyadh"],
  ["منيرة السديري", "pm-delivery", 3, "Riyadh"],
  ["أحمد الثبيتي", "junior-dev", 1, "Dammam"],
];

export const UNIVERSITIES = [
  ["King Saud University", "جامعة الملك سعود"],
  ["King Abdulaziz University", "جامعة الملك عبدالعزيز"],
  ["King Fahd University of Petroleum and Minerals", "جامعة الملك فهد للبترول والمعادن"],
  ["Princess Nourah bint Abdulrahman University", "جامعة الأميرة نورة بنت عبدالرحمن"],
  ["Imam Abdulrahman Bin Faisal University", "جامعة الإمام عبدالرحمن بن فيصل"],
  ["Umm Al-Qura University", "جامعة أم القرى"],
] as const;

export const DEGREE_BY_ROLE: Record<string, string> = {
  "data-analyst": "B.Sc. Statistics",
  fullstack: "B.Sc. Computer Science",
  "junior-dev": "B.Sc. Software Engineering",
  backend: "B.Sc. Computer Engineering",
  "ux-designer": "B.Des. Digital Media",
  "soc-analyst": "B.Sc. Cybersecurity",
  "ai-engineer": "M.Sc. Artificial Intelligence",
  "cloud-engineer": "B.Sc. Information Technology",
  "business-analyst": "B.Sc. Information Systems",
  "data-engineer": "B.Sc. Computer Science",
  "data-scientist": "M.Sc. Data Science",
  appsec: "B.Sc. Computer Science",
  "product-manager": "B.Sc. Industrial Engineering",
  "ml-engineer": "M.Sc. Computer Science",
  "pm-delivery": "B.Sc. Management Information Systems",
};

/** Fictional previous employers (generic, not real companies). */
export const PAST_EMPLOYERS = [
  "Bayan Systems",
  "Masar Digital",
  "Qimma Tech Studio",
  "Athar Analytics",
  "Sahab Cloud Services",
  "Tamkeen Labs",
  "Diyar Retail Group",
  "Nukhba Consulting",
];

/** Company staff (beyond the company admin): recruiter + interviewer per approved company. */
export const STAFF_NAMES: Record<string, [string, string, string]> = {
  nawat: ["مشعل الراشد", "أروى الحمدان", "طارق الفهيد"],
  ofuq: ["هند البلوي", "سامي الخثلان", "رنا الغامدي"],
  rakeeza: ["عادل المهنا", "نوف الشريف", "بدر العبيد"],
  wasl: ["وليد بخش", "لطيفة الحربي", "يوسف باعشن"],
  madar: ["سعود الفايز", "ديما الحسن", "أنس المزيني"],
  nabd: ["عبير الدوسري", "فيصل الشمراني", "منى القاسم"],
  rawafid: ["حمد البريك", "جواهر العجمي", "مازن العطاس"],
  souqa: ["ريان باحمدان", "سمية الزهراني", "كريم الجفري"],
  haseen: ["ناصر الشهري", "أمل المحمادي", "حاتم العمري"],
  imtidad: ["خلود السالم", "عمار الحازمي", "تهاني الرويس"],
};
