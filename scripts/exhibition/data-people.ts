/** Exhibition identities (fictional). Employers join existing registry organizations; no organization is created. */

export type Staff = { email: string; ar: string; en: string; registry: string; role: "recruiter" | "interviewer"; title: string };

const staff = (short: string, registry: string, rec: [string, string, string], int: [string, string, string]): Staff[] => [
  { email: `recruiter.${short}@jadarah.example`, ar: rec[0], en: rec[1], registry, role: "recruiter", title: rec[2] },
  { email: `interviewer.${short}@jadarah.example`, ar: int[0], en: int[1], registry, role: "interviewer", title: int[2] },
];

export const STAFF: Staff[] = [
  ...staff("moc", "ALM-001", ["منيرة الرشيد", "Munira Alrasheed", "Talent Acquisition Specialist"], ["سعود البقمي", "Saud Albaqami", "Legal Affairs Manager"]),
  ...staff("gea", "ALM-002", ["لينا الفهد", "Lina Alfahad", "Recruitment Lead"], ["ماجد العسيري", "Majed Alasiri", "Communications Director"]),
  ...staff("dgda", "ALM-004", ["أروى الجهني", "Arwa Aljohani", "HR Business Partner"], ["يوسف الحارثي", "Yousef Alharthi", "Procurement Manager"]),
  ...staff("sipchem", "ALM-007", ["عهود الخالدي", "Ohoud Alkhalidi", "Talent Acquisition Specialist"], ["مشعل الرويلي", "Mishal Alruwaili", "Supply Chain Manager"]),
  ...staff("srsa", "ALM-008", ["ريناد البلوي", "Renad Albalawi", "Recruitment Specialist"], ["عمر الأحمدي", "Omar Alahmadi", "Marine Operations Manager"]),
  ...staff("mof", "ALM-009", ["هند السديري", "Hind Alsudairi", "Talent Acquisition Lead"], ["ناصر العمري", "Nasser Alomari", "Budget Planning Director"]),
  ...staff("sidf", "ALM-010", ["أمل القرشي", "Amal Alqurashi", "HR Specialist"], ["بدر الشهري", "Badr Alshehri", "Internal Audit Manager"]),
];

export type NewCandidate = {
  key: string;
  email: string;
  ar: string;
  en: string;
  headline: string;
  summary: string;
  city: string;
  years: number;
  level: "entry" | "junior" | "mid";
  interests: string[];
  education: { institution: string; degree: string; field: string; start: string; end: string; grade: string };
  experience: { title: string; company: string; location: string; start: string; end: string | null; description: string }[];
  projects: { title: string; description: string; skills: string[] }[];
  certs: { name: string; issuer: string; date: string }[];
  skills: [string, number][];
  roles: string[];
};

const c = (x: NewCandidate) => x;

export const CANDIDATES: NewCandidate[] = [
  c({
    key: "noura",
    email: "noura.alotaibi@jadarah.example",
    ar: "نورة العتيبي",
    en: "Noura Alotaibi",
    headline: "Commercial law graduate focused on consumer protection and e-commerce regulation",
    summary:
      "Law graduate with a training period in a commercial law firm in Riyadh. I research consumer-protection cases, draft legal memos and summarise regulations for non-lawyers. Interested in commercial regulation and compliance in the public sector.",
    city: "Riyadh",
    years: 1,
    level: "junior",
    interests: ["Legal & compliance", "Consumer protection", "Public sector"],
    education: { institution: "King Saud University", degree: "Bachelor of Laws (LLB)", field: "Law", start: "2020-09-01", end: "2024-06-30", grade: "4.62 / 5" },
    experience: [
      { title: "Legal Trainee", company: "Commercial law firm (Riyadh)", location: "Riyadh", start: "2024-08-01", end: "2025-07-31", description: "Drafted legal memos on e-commerce disputes, prepared case files and contract reviews under supervision." },
    ],
    projects: [{ title: "E-commerce complaints study", description: "Graduation research classifying 120 anonymised consumer complaints by legal issue and remedy.", skills: ["Regulatory Compliance", "Policy Analysis"] }],
    certs: [{ name: "Legal Drafting in Arabic", issuer: "Professional training institute", date: "2024-03-15" }],
    skills: [["Regulatory Compliance", 4], ["Consumer Protection", 4], ["Policy Analysis", 3], ["Arabic & English Business Writing", 4], ["Critical Thinking", 4]],
    roles: ["Legal Specialist", "Compliance Analyst"],
  }),
  c({
    key: "abdulaziz",
    email: "abdulaziz.alqahtani@jadarah.example",
    ar: "عبدالعزيز القحطاني",
    en: "Abdulaziz Alqahtani",
    headline: "Industrial engineer — inventory planning, supply chain analytics and Excel modelling",
    summary:
      "Industrial engineering graduate who interned in a petrochemical plant's materials team. I build reorder and inventory models, analyse supplier lead times and present clear recommendations to operations teams.",
    city: "Al Jubail",
    years: 2,
    level: "junior",
    interests: ["Supply chain", "Operations", "Manufacturing"],
    education: { institution: "King Fahd University of Petroleum and Minerals", degree: "Bachelor of Science", field: "Industrial and Systems Engineering", start: "2018-09-01", end: "2023-05-31", grade: "3.41 / 4" },
    experience: [
      { title: "Materials Planning Intern", company: "Petrochemical manufacturer (Jubail)", location: "Al Jubail", start: "2022-06-01", end: "2022-08-31", description: "Reviewed min/max levels for 300 spare parts and proposed reorder points from consumption history." },
      { title: "Supply Chain Coordinator", company: "Industrial services company", location: "Dammam", start: "2023-09-01", end: null, description: "Tracks purchase orders and supplier delivery performance; maintains the weekly inventory dashboard." },
    ],
    projects: [{ title: "Reorder point model", description: "Excel model computing reorder points and safety stock for critical spares with lead-time variability.", skills: ["Advanced Excel", "Statistics"] }],
    certs: [{ name: "Lean Six Sigma Yellow Belt", issuer: "Training provider", date: "2023-11-10" }],
    skills: [["Advanced Excel", 5], ["Vendor Management", 3], ["Statistics", 4], ["Problem Solving", 4], ["Lean Six Sigma", 3]],
    roles: ["Supply Chain Analyst", "Procurement Specialist"],
  }),
  c({
    key: "sarah",
    email: "sarah.alharbi@jadarah.example",
    ar: "سارة الحربي",
    en: "Sarah Alharbi",
    headline: "Public relations and media graduate — crisis communication and event media",
    summary:
      "Media graduate with experience in event communication: press releases, social media monitoring and spokesperson briefs. I enjoy turning complex situations into clear, honest messages.",
    city: "Riyadh",
    years: 1,
    level: "junior",
    interests: ["Public relations", "Marketing & communications", "Entertainment"],
    education: { institution: "Imam Mohammad Ibn Saud Islamic University", degree: "Bachelor of Arts", field: "Public Relations and Media", start: "2020-09-01", end: "2024-06-30", grade: "4.41 / 5" },
    experience: [{ title: "Media Coordinator (contract)", company: "Events agency", location: "Riyadh", start: "2024-09-01", end: "2025-09-30", description: "Prepared press kits and monitored social media during seasonal events; drafted holding statements." }],
    projects: [{ title: "Sentiment tracking for a festival", description: "Weekly sentiment report from public social posts with response recommendations.", skills: ["Communication", "Data Visualization"] }],
    certs: [{ name: "Crisis Communication Fundamentals", issuer: "Online learning platform", date: "2024-10-05" }],
    skills: [["Communication", 5], ["Arabic & English Business Writing", 4], ["Stakeholder Management", 3], ["Event Planning", 3]],
    roles: ["Public Relations Specialist", "Content Specialist"],
  }),
  c({
    key: "joud",
    email: "joud.alshammari@jadarah.example",
    ar: "جود الشمري",
    en: "Joud Alshammari",
    headline: "HR graduate — talent acquisition, recruitment analytics and onboarding",
    summary:
      "Human resources graduate who supported technical hiring as an intern. I track recruitment funnels, coordinate interviews and design onboarding checklists that help new joiners become productive faster.",
    city: "Riyadh",
    years: 1,
    level: "junior",
    interests: ["Human resources", "Talent acquisition", "Technology companies"],
    education: { institution: "Princess Nourah bint Abdulrahman University", degree: "Bachelor of Business Administration", field: "Human Resource Management", start: "2019-09-01", end: "2023-06-30", grade: "4.70 / 5" },
    experience: [{ title: "Talent Acquisition Intern", company: "Technology company (Riyadh)", location: "Riyadh", start: "2023-07-01", end: "2024-01-31", description: "Screened applications for engineering roles, scheduled interviews and maintained funnel reports." }],
    projects: [{ title: "Recruitment dashboard", description: "Funnel and time-to-hire dashboard for three roles, with weekly commentary.", skills: ["Data Visualization", "Advanced Excel"] }],
    certs: [{ name: "Recruitment and Selection", issuer: "HR training institute", date: "2023-09-20" }],
    skills: [["Communication", 4], ["Stakeholder Management", 4], ["Advanced Excel", 4], ["Data Visualization", 3]],
    roles: ["Talent Acquisition Specialist", "HR Specialist"],
  }),
  c({
    key: "reem_m",
    email: "reem.almutairi@jadarah.example",
    ar: "ريم المطيري",
    en: "Reem Almutairi",
    headline: "Accountant — internal audit, controls testing and IFRS reporting",
    summary:
      "Accounting graduate with two years in an audit firm's assurance team. I test internal controls, document findings in condition–criteria–cause–effect format and build audit sampling workbooks.",
    city: "Jeddah",
    years: 2,
    level: "junior",
    interests: ["Internal audit", "Finance", "Risk"],
    education: { institution: "King Abdulaziz University", degree: "Bachelor of Science", field: "Accounting", start: "2017-09-01", end: "2022-06-30", grade: "4.55 / 5" },
    experience: [{ title: "Audit Associate", company: "Audit and assurance firm", location: "Jeddah", start: "2022-09-01", end: null, description: "Tested approval and disbursement controls for financing clients; drafted findings for management letters." }],
    projects: [{ title: "Controls testing template", description: "Workbook template for attribute sampling with automatic exception flags.", skills: ["Advanced Excel", "Risk Assessment"] }],
    certs: [{ name: "SOCPA Fellowship — Part 1", issuer: "Professional accounting body", date: "2024-05-12" }],
    skills: [["IFRS Accounting", 4], ["Risk Assessment", 4], ["Regulatory Compliance", 3], ["Advanced Excel", 4]],
    roles: ["Internal Audit Associate", "Accountant"],
  }),
  c({
    key: "turki",
    email: "turki.alsubaie@jadarah.example",
    ar: "تركي السبيعي",
    en: "Turki Alsubaie",
    headline: "Finance graduate — budgeting, variance analysis and public finance",
    summary:
      "Finance graduate interested in public finance. I prepare budget-versus-actual reports, explain variances in plain language and propose reallocations backed by data.",
    city: "Riyadh",
    years: 1,
    level: "junior",
    interests: ["Finance & accounting", "Public sector", "Budgeting"],
    education: { institution: "Alfaisal University", degree: "Bachelor of Business", field: "Finance", start: "2019-09-01", end: "2023-06-30", grade: "3.62 / 4" },
    experience: [{ title: "Financial Planning Intern", company: "Government entity (Riyadh)", location: "Riyadh", start: "2023-07-01", end: "2024-06-30", description: "Prepared monthly variance packs and supported the annual budget call." }],
    projects: [{ title: "Program budget tracker", description: "Variance workbook with thresholds and automated commentary prompts.", skills: ["Budgeting & Forecasting", "Advanced Excel"] }],
    certs: [{ name: "Financial Modeling Fundamentals", issuer: "Online learning platform", date: "2023-04-02" }],
    skills: [["Budgeting & Forecasting", 4], ["Financial Analysis", 4], ["Advanced Excel", 5], ["Power BI", 3]],
    roles: ["Budget Analyst", "Financial Analyst"],
  }),
  c({
    key: "khalid",
    email: "khalid.alanazi@jadarah.example",
    ar: "خالد العنزي",
    en: "Khalid Alanazi",
    headline: "Business graduate — customer experience, complaint analysis and service design",
    summary:
      "Business administration graduate with front-line experience in a telecom retail store. I analyse complaint data, map customer journeys and suggest improvements that reduce repeat contacts.",
    city: "Buraydah",
    years: 2,
    level: "junior",
    interests: ["Customer experience", "Marketing", "Telecommunications"],
    education: { institution: "Qassim University", degree: "Bachelor of Business Administration", field: "Marketing", start: "2017-09-01", end: "2022-01-31", grade: "4.12 / 5" },
    experience: [{ title: "Customer Service Representative", company: "Telecom retail store", location: "Buraydah", start: "2022-03-01", end: null, description: "Resolved billing and device issues; logged root causes of repeat visits for the store manager." }],
    projects: [{ title: "Repeat-visit analysis", description: "Categorised 600 store visits and identified the top three causes of repeat contacts.", skills: ["Customer Experience", "Root Cause Analysis"] }],
    certs: [{ name: "Customer Experience Management", issuer: "Training provider", date: "2023-02-18" }],
    skills: [["Customer Experience", 4], ["Communication", 4], ["Root Cause Analysis", 3], ["Data Visualization", 2]],
    roles: ["Customer Experience Specialist", "Marketing Specialist"],
  }),
  c({
    key: "haya",
    email: "haya.aldosari@jadarah.example",
    ar: "هيا الدوسري",
    en: "Haya Aldosari",
    headline: "Economics and public policy graduate — strategy, OKRs and policy research",
    summary:
      "Economics graduate with a research assistantship in public policy. I turn survey and adoption data into strategy briefs with clear initiatives, owners and measurable objectives.",
    city: "Riyadh",
    years: 1,
    level: "junior",
    interests: ["Strategy", "Research", "Digital government"],
    education: { institution: "King Saud University", degree: "Bachelor of Arts", field: "Economics", start: "2019-09-01", end: "2023-06-30", grade: "4.58 / 5" },
    experience: [{ title: "Research Assistant", company: "University policy research centre", location: "Riyadh", start: "2023-09-01", end: "2025-06-30", description: "Analysed adoption surveys for digital services and co-wrote policy briefs." }],
    projects: [{ title: "Digital service adoption study", description: "Barrier analysis of 40 public entities with a prioritised roadmap.", skills: ["Policy Analysis", "Data Visualization"] }],
    certs: [{ name: "Strategy Execution with OKRs", issuer: "Online learning platform", date: "2024-01-22" }],
    skills: [["Policy Analysis", 4], ["Critical Thinking", 5], ["Stakeholder Management", 3], ["Data Visualization", 3]],
    roles: ["Strategy Analyst", "Research Associate"],
  }),
  c({
    key: "bandar",
    email: "bandar.alzahrani@jadarah.example",
    ar: "بندر الزهراني",
    en: "Bandar Alzahrani",
    headline: "Marine sciences graduate — maritime operations, permits and process improvement",
    summary:
      "Marine sciences graduate with port operations experience. I document permit processes, track turnaround times and propose practical improvements with regulators and operators.",
    city: "Jeddah",
    years: 3,
    level: "mid",
    interests: ["Operations", "Maritime", "Tourism"],
    education: { institution: "King Abdulaziz University", degree: "Bachelor of Science", field: "Marine Sciences", start: "2015-09-01", end: "2020-06-30", grade: "3.95 / 5" },
    experience: [{ title: "Port Operations Officer", company: "Marine services company", location: "Jeddah", start: "2021-02-01", end: null, description: "Coordinates vessel documentation and inspections; maintains turnaround reports." }],
    projects: [{ title: "Berth permit turnaround", description: "Mapped the permit workflow and reduced document rework through a checklist.", skills: ["Process Modeling (BPMN)", "Root Cause Analysis"] }],
    certs: [{ name: "Process Mapping with BPMN", issuer: "Training provider", date: "2022-10-30" }],
    skills: [["Process Modeling (BPMN)", 3], ["Regulatory Compliance", 3], ["Root Cause Analysis", 3], ["Stakeholder Management", 3]],
    roles: ["Operations Specialist", "Project Coordinator"],
  }),
  c({
    key: "lujain",
    email: "lujain.alomari@jadarah.example",
    ar: "لجين العمري",
    en: "Lujain Alomari",
    headline: "Supply chain graduate — procurement, tender evaluation and vendor management",
    summary:
      "Supply chain management graduate who supported a procurement team in a construction project. I prepare tender evaluation sheets, compare bids fairly and document award recommendations.",
    city: "Riyadh",
    years: 1,
    level: "junior",
    interests: ["Procurement", "Operations & supply chain", "Urban development"],
    education: { institution: "Prince Sultan University", degree: "Bachelor of Science", field: "Supply Chain Management", start: "2020-09-01", end: "2024-06-30", grade: "3.71 / 4" },
    experience: [{ title: "Procurement Trainee", company: "Construction project management office", location: "Riyadh", start: "2024-07-01", end: "2025-06-30", description: "Prepared bid comparison sheets and supplier qualification files." }],
    projects: [{ title: "Weighted tender evaluation", description: "Template applying technical thresholds and price scoring for public tenders.", skills: ["Vendor Management", "Cost Estimation"] }],
    certs: [{ name: "Procurement Fundamentals", issuer: "Professional procurement body", date: "2024-09-14" }],
    skills: [["Vendor Management", 4], ["Cost Estimation", 3], ["Advanced Excel", 4], ["Regulatory Compliance", 3]],
    roles: ["Procurement Specialist", "Supply Chain Analyst"],
  }),
];
