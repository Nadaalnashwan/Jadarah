/**
 * Curated, non-registry fields for the initial organizations: platform slug, Arabic sector/type
 * labels, and SIMULATION opportunities (clearly labelled; never presented as official vacancies).
 * Registry facts (names, websites, verification, sources) are read from the source workbook.
 * Simulation roles follow each organization's registry sector and the reference roles available in
 * the assessment package; they make no claim about the organization's actual recruitment needs.
 */
export type SimJob = {
  title_en: string;
  title_ar: string;
  level: "entry" | "junior" | "mid" | "senior";
  min_years: number;
  category: string;
  work_mode: "onsite" | "hybrid" | "remote";
  description_en: string;
  description_ar: string;
  responsibilities_en: string[];
  responsibilities_ar: string[];
  qualifications_en: string[];
  qualifications_ar: string[];
  skills: [slug: string, importance: "required" | "preferred", min_level: number][];
};

export const ORGS: Record<string, { slug: string; type_ar: string; sector_ar: string; city: string; jobs: SimJob[] }> = {
  "ALM-001": {
    slug: "ministry-of-commerce",
    type_ar: "وزارة حكومية",
    sector_ar: "التجارة والتنظيم",
    city: "Riyadh",
    jobs: [
      {
        title_en: "Trade Compliance Specialist", title_ar: "أخصائي امتثال تجاري", level: "mid", min_years: 3, category: "public-sector", work_mode: "onsite",
        description_en: "Review commercial activity against applicable regulations and document compliance findings.",
        description_ar: "مراجعة الأنشطة التجارية وفق الأنظمة المعمول بها وتوثيق نتائج الامتثال.",
        responsibilities_en: ["Assess cases against regulatory requirements", "Prepare evidence-based compliance reports", "Recommend corrective actions"],
        responsibilities_ar: ["تقييم الحالات وفق المتطلبات التنظيمية", "إعداد تقارير امتثال مدعومة بالأدلة", "اقتراح الإجراءات التصحيحية"],
        qualifications_en: ["Degree in law, business or a related field", "3+ years in compliance or inspection", "Strong analytical writing"],
        qualifications_ar: ["درجة في القانون أو الأعمال أو مجال ذي صلة", "خبرة 3 سنوات فأكثر في الامتثال أو التفتيش", "مهارة عالية في الكتابة التحليلية"],
        skills: [["regulatory-compliance", "required", 3], ["risk-assessment", "required", 3], ["policy-analysis", "preferred", 2], ["excel", "preferred", 2], ["communication", "required", 3]],
      },
      {
        title_en: "Consumer Protection Analyst", title_ar: "محلل حماية المستهلك", level: "junior", min_years: 1, category: "public-sector", work_mode: "onsite",
        description_en: "Analyse consumer complaints and market data to identify patterns and priority issues.",
        description_ar: "تحليل شكاوى المستهلكين وبيانات السوق لتحديد الأنماط والقضايا ذات الأولوية.",
        responsibilities_en: ["Classify and analyse complaint data", "Identify recurring violations", "Summarise findings for decision-makers"],
        responsibilities_ar: ["تصنيف بيانات الشكاوى وتحليلها", "رصد المخالفات المتكررة", "تلخيص النتائج لمتخذي القرار"],
        qualifications_en: ["Degree in business, economics or law", "Experience with data analysis tools", "Clear written communication"],
        qualifications_ar: ["درجة في الأعمال أو الاقتصاد أو القانون", "خبرة في أدوات تحليل البيانات", "تواصل كتابي واضح"],
        skills: [["consumer-protection", "required", 2], ["data-visualization", "preferred", 2], ["excel", "required", 3], ["critical-thinking", "required", 3]],
      },
    ],
  },
  "ALM-002": {
    slug: "general-entertainment-authority",
    type_ar: "هيئة حكومية",
    sector_ar: "الترفيه",
    city: "Riyadh",
    jobs: [
      {
        title_en: "Event Coordinator", title_ar: "منسق فعاليات", level: "mid", min_years: 2, category: "events", work_mode: "onsite",
        description_en: "Plan and coordinate event operations, vendors and safety requirements.",
        description_ar: "تخطيط عمليات الفعاليات وتنسيقها مع الموردين ومتطلبات السلامة.",
        responsibilities_en: ["Build event run-of-show and timelines", "Coordinate vendors and permits", "Manage operational and crowd risks"],
        responsibilities_ar: ["إعداد الجدول التشغيلي والخط الزمني للفعالية", "التنسيق مع الموردين والتصاريح", "إدارة المخاطر التشغيلية ومخاطر الحشود"],
        qualifications_en: ["2+ years in event operations", "Vendor and budget coordination", "Risk planning experience"],
        qualifications_ar: ["خبرة سنتين فأكثر في تشغيل الفعاليات", "تنسيق الموردين والميزانيات", "خبرة في تخطيط المخاطر"],
        skills: [["event-planning", "required", 3], ["event-risk-management", "required", 3], ["vendor-management", "required", 2], ["stakeholder-management", "preferred", 3]],
      },
      {
        title_en: "Event Marketing Specialist", title_ar: "أخصائي تسويق فعاليات", level: "junior", min_years: 1, category: "events", work_mode: "hybrid",
        description_en: "Plan audience campaigns for events and measure their performance.",
        description_ar: "تخطيط حملات الجمهور للفعاليات وقياس أدائها.",
        responsibilities_en: ["Define target audiences and channels", "Plan campaign calendars", "Report campaign results"],
        responsibilities_ar: ["تحديد الجمهور المستهدف والقنوات", "تخطيط تقويم الحملات", "إعداد تقارير نتائج الحملات"],
        qualifications_en: ["Degree in marketing or communications", "Campaign planning experience", "Comfort with performance data"],
        qualifications_ar: ["درجة في التسويق أو الاتصال", "خبرة في تخطيط الحملات", "إلمام ببيانات الأداء"],
        skills: [["customer-experience", "required", 2], ["data-visualization", "preferred", 2], ["communication", "required", 3], ["event-planning", "preferred", 2]],
      },
    ],
  },
  "ALM-003": {
    slug: "elm-company",
    type_ar: "شركة مساهمة سعودية",
    sector_ar: "الحلول الرقمية",
    city: "Riyadh",
    jobs: [
      {
        title_en: "Software Engineer", title_ar: "مهندس برمجيات", level: "mid", min_years: 3, category: "software", work_mode: "hybrid",
        description_en: "Design, build and test reliable web services and user-facing features.",
        description_ar: "تصميم خدمات وميزات ويب موثوقة وبناؤها واختبارها.",
        responsibilities_en: ["Implement features with automated tests", "Design clean APIs", "Review code and improve reliability"],
        responsibilities_ar: ["تنفيذ الميزات مع اختبارات آلية", "تصميم واجهات برمجية واضحة", "مراجعة الشيفرة وتحسين الاعتمادية"],
        qualifications_en: ["3+ years of software development", "TypeScript/Node.js or similar", "Testing and version control"],
        qualifications_ar: ["خبرة 3 سنوات فأكثر في تطوير البرمجيات", "TypeScript/Node.js أو ما يماثلها", "الاختبارات وإدارة الإصدارات"],
        skills: [["typescript", "required", 3], ["nodejs", "required", 3], ["api-design", "required", 3], ["testing", "required", 3], ["react", "preferred", 3], ["git", "preferred", 3]],
      },
      {
        title_en: "Data Analyst", title_ar: "محلل بيانات", level: "junior", min_years: 1, category: "data", work_mode: "hybrid",
        description_en: "Turn operational data into clear, decision-ready insights.",
        description_ar: "تحويل البيانات التشغيلية إلى رؤى واضحة جاهزة لاتخاذ القرار.",
        responsibilities_en: ["Clean and model datasets", "Build dashboards", "Communicate findings"],
        responsibilities_ar: ["تنظيف البيانات ونمذجتها", "بناء لوحات المعلومات", "إيصال النتائج"],
        qualifications_en: ["SQL and Python", "BI tooling", "Statistical reasoning"],
        qualifications_ar: ["SQL وPython", "أدوات ذكاء الأعمال", "التفكير الإحصائي"],
        skills: [["sql", "required", 3], ["python", "required", 2], ["power-bi", "preferred", 3], ["statistics", "required", 2]],
      },
    ],
  },
  "ALM-004": {
    slug: "diriyah-gate-development-authority",
    type_ar: "هيئة حكومية",
    sector_ar: "التراث والتطوير العمراني",
    city: "Riyadh",
    jobs: [
      {
        title_en: "Project Planner", title_ar: "مخطط مشاريع", level: "mid", min_years: 4, category: "engineering", work_mode: "onsite",
        description_en: "Build and maintain integrated schedules for development projects.",
        description_ar: "إعداد الجداول الزمنية المتكاملة لمشاريع التطوير ومتابعتها.",
        responsibilities_en: ["Develop baseline schedules and critical paths", "Track progress and forecast delays", "Report schedule risks"],
        responsibilities_ar: ["إعداد الجداول الأساسية والمسار الحرج", "متابعة التقدم وتوقع التأخيرات", "الإبلاغ عن مخاطر الجدول"],
        qualifications_en: ["Engineering degree", "4+ years of project planning", "Primavera P6 or equivalent"],
        qualifications_ar: ["درجة في الهندسة", "خبرة 4 سنوات فأكثر في تخطيط المشاريع", "Primavera P6 أو ما يماثله"],
        skills: [["project-scheduling", "required", 4], ["construction-management", "required", 3], ["risk-assessment", "required", 3], ["cost-estimation", "preferred", 2]],
      },
      {
        title_en: "Civil Engineer", title_ar: "مهندس مدني", level: "mid", min_years: 3, category: "engineering", work_mode: "onsite",
        description_en: "Support design reviews, quantities and site execution for civil works.",
        description_ar: "دعم مراجعات التصميم والكميات والتنفيذ الميداني للأعمال المدنية.",
        responsibilities_en: ["Review drawings and quantities", "Coordinate site execution", "Ensure quality and safety"],
        responsibilities_ar: ["مراجعة المخططات والكميات", "تنسيق التنفيذ في الموقع", "ضمان الجودة والسلامة"],
        qualifications_en: ["Civil engineering degree", "3+ years of site or design experience", "Saudi Council of Engineers membership"],
        qualifications_ar: ["درجة في الهندسة المدنية", "خبرة 3 سنوات فأكثر في الموقع أو التصميم", "عضوية الهيئة السعودية للمهندسين"],
        skills: [["construction-management", "required", 3], ["cost-estimation", "required", 3], ["project-scheduling", "preferred", 2], ["process-safety", "preferred", 2]],
      },
    ],
  },
  "ALM-005": {
    slug: "saudi-telecom-company",
    type_ar: "شركة مدرجة",
    sector_ar: "الاتصالات",
    city: "Riyadh",
    jobs: [
      {
        title_en: "Data Analyst", title_ar: "محلل بيانات", level: "mid", min_years: 2, category: "data", work_mode: "hybrid",
        description_en: "Analyse service usage and customer metrics to support product decisions.",
        description_ar: "تحليل بيانات استخدام الخدمات ومؤشرات العملاء لدعم قرارات المنتجات.",
        responsibilities_en: ["Analyse usage and churn indicators", "Build KPI dashboards", "Present recommendations"],
        responsibilities_ar: ["تحليل مؤشرات الاستخدام والتسرب", "بناء لوحات مؤشرات الأداء", "تقديم التوصيات"],
        qualifications_en: ["2+ years in analytics", "SQL and Python", "Data storytelling"],
        qualifications_ar: ["خبرة سنتين فأكثر في التحليل", "SQL وPython", "سرد البيانات"],
        skills: [["sql", "required", 3], ["python", "required", 3], ["pandas", "preferred", 3], ["data-visualization", "required", 3], ["statistics", "required", 3]],
      },
      {
        title_en: "UI/UX Designer", title_ar: "مصمم واجهات وتجربة مستخدم", level: "mid", min_years: 3, category: "design", work_mode: "hybrid",
        description_en: "Design accessible, research-led digital experiences.",
        description_ar: "تصميم تجارب رقمية سهلة الوصول قائمة على البحث.",
        responsibilities_en: ["Run user research", "Prototype and test flows", "Maintain design consistency"],
        responsibilities_ar: ["إجراء أبحاث المستخدمين", "بناء النماذج الأولية واختبارها", "الحفاظ على اتساق التصميم"],
        qualifications_en: ["Portfolio of shipped work", "Figma", "Accessibility knowledge"],
        qualifications_ar: ["ملف أعمال منفّذة", "Figma", "معرفة بإتاحة الوصول"],
        skills: [["figma", "required", 4], ["user-research", "required", 3], ["prototyping", "required", 3], ["accessibility", "preferred", 2]],
      },
    ],
  },
  "ALM-006": {
    slug: "sdaia",
    type_ar: "هيئة حكومية",
    sector_ar: "البيانات والذكاء الاصطناعي",
    city: "Riyadh",
    jobs: [
      {
        title_en: "ML Engineer", title_ar: "مهندس تعلم آلة", level: "mid", min_years: 3, category: "ai", work_mode: "hybrid",
        description_en: "Build, evaluate and ship reproducible machine-learning models.",
        description_ar: "بناء نماذج تعلم الآلة وتقييمها وإطلاقها بشكل قابل لإعادة الإنتاج.",
        responsibilities_en: ["Train and evaluate models", "Ensure reproducibility", "Monitor models in production"],
        responsibilities_ar: ["تدريب النماذج وتقييمها", "ضمان قابلية إعادة الإنتاج", "مراقبة النماذج في بيئة التشغيل"],
        qualifications_en: ["3+ years in ML", "Python ML stack", "Sound evaluation practice"],
        qualifications_ar: ["خبرة 3 سنوات فأكثر في تعلم الآلة", "أدوات Python لتعلم الآلة", "منهجية تقييم سليمة"],
        skills: [["python", "required", 4], ["machine-learning", "required", 4], ["scikit-learn", "required", 3], ["mlops", "preferred", 2], ["statistics", "required", 3]],
      },
      {
        title_en: "Data Analyst", title_ar: "محلل بيانات", level: "junior", min_years: 1, category: "data", work_mode: "hybrid",
        description_en: "Prepare and analyse datasets and communicate data quality findings.",
        description_ar: "إعداد البيانات وتحليلها وإيصال نتائج جودة البيانات.",
        responsibilities_en: ["Profile and clean datasets", "Analyse trends", "Document data quality"],
        responsibilities_ar: ["فحص البيانات وتنظيفها", "تحليل الاتجاهات", "توثيق جودة البيانات"],
        qualifications_en: ["SQL", "Python or R", "Attention to detail"],
        qualifications_ar: ["SQL", "Python أو R", "الدقة والاهتمام بالتفاصيل"],
        skills: [["sql", "required", 3], ["python", "required", 2], ["statistics", "required", 2], ["data-modeling", "preferred", 2]],
      },
    ],
  },
  "ALM-007": {
    slug: "sipchem",
    type_ar: "شركة مدرجة",
    sector_ar: "البتروكيماويات",
    city: "Jubail",
    jobs: [
      {
        title_en: "Quality Engineer", title_ar: "مهندس جودة", level: "mid", min_years: 3, category: "engineering", work_mode: "onsite",
        description_en: "Monitor process quality, investigate deviations and drive improvements.",
        description_ar: "مراقبة جودة العمليات والتحقيق في الانحرافات وقيادة التحسينات.",
        responsibilities_en: ["Analyse quality data with SPC", "Lead root-cause investigations", "Maintain QMS documentation"],
        responsibilities_ar: ["تحليل بيانات الجودة باستخدام الضبط الإحصائي", "قيادة تحقيقات السبب الجذري", "تحديث وثائق نظام إدارة الجودة"],
        qualifications_en: ["Chemical or industrial engineering degree", "3+ years in quality", "ISO 9001 familiarity"],
        qualifications_ar: ["درجة في الهندسة الكيميائية أو الصناعية", "خبرة 3 سنوات فأكثر في الجودة", "إلمام بمعيار ISO 9001"],
        skills: [["quality-control", "required", 3], ["root-cause-analysis", "required", 3], ["iso-9001", "required", 2], ["lean-six-sigma", "preferred", 2], ["statistics", "preferred", 3]],
      },
      {
        title_en: "Maintenance Engineer", title_ar: "مهندس صيانة", level: "mid", min_years: 4, category: "engineering", work_mode: "onsite",
        description_en: "Plan maintenance and improve equipment reliability.",
        description_ar: "تخطيط الصيانة وتحسين اعتمادية المعدات.",
        responsibilities_en: ["Build preventive maintenance plans", "Analyse failures", "Apply safe work practices"],
        responsibilities_ar: ["إعداد خطط الصيانة الوقائية", "تحليل الأعطال", "تطبيق ممارسات العمل الآمن"],
        qualifications_en: ["Mechanical engineering degree", "4+ years in plant maintenance", "CMMS experience"],
        qualifications_ar: ["درجة في الهندسة الميكانيكية", "خبرة 4 سنوات فأكثر في صيانة المصانع", "خبرة في أنظمة إدارة الصيانة"],
        skills: [["maintenance-planning", "required", 3], ["root-cause-analysis", "required", 3], ["process-safety", "required", 3]],
      },
    ],
  },
  "ALM-008": {
    slug: "saudi-red-sea-authority",
    type_ar: "هيئة حكومية",
    sector_ar: "تنظيم السياحة الساحلية",
    city: "Jeddah",
    jobs: [
      {
        title_en: "Coastal Tourism Compliance Officer", title_ar: "مسؤول امتثال السياحة الساحلية", level: "mid", min_years: 3, category: "public-sector", work_mode: "onsite",
        description_en: "Review coastal tourism activities against licensing and safety requirements.",
        description_ar: "مراجعة أنشطة السياحة الساحلية وفق متطلبات الترخيص والسلامة.",
        responsibilities_en: ["Assess operator compliance", "Document findings and risks", "Coordinate with stakeholders"],
        responsibilities_ar: ["تقييم امتثال المشغلين", "توثيق النتائج والمخاطر", "التنسيق مع أصحاب المصلحة"],
        qualifications_en: ["Degree in tourism, marine or regulatory studies", "3+ years in compliance or licensing", "Strong reporting"],
        qualifications_ar: ["درجة في السياحة أو العلوم البحرية أو التنظيم", "خبرة 3 سنوات فأكثر في الامتثال أو الترخيص", "مهارة عالية في كتابة التقارير"],
        skills: [["regulatory-compliance", "required", 3], ["risk-assessment", "required", 3], ["stakeholder-management", "preferred", 2]],
      },
      {
        title_en: "Tourism Operations Coordinator", title_ar: "منسق عمليات سياحية", level: "junior", min_years: 1, category: "events", work_mode: "onsite",
        description_en: "Coordinate tourism programmes, schedules and visitor experience.",
        description_ar: "تنسيق البرامج السياحية والجداول وتجربة الزوار.",
        responsibilities_en: ["Plan itineraries and logistics", "Coordinate operators", "Track visitor feedback"],
        responsibilities_ar: ["تخطيط المسارات واللوجستيات", "التنسيق مع المشغلين", "متابعة ملاحظات الزوار"],
        qualifications_en: ["Degree in tourism or hospitality", "Coordination experience", "Arabic and English"],
        qualifications_ar: ["درجة في السياحة أو الضيافة", "خبرة في التنسيق", "العربية والإنجليزية"],
        skills: [["event-planning", "required", 2], ["customer-experience", "required", 3], ["vendor-management", "preferred", 2], ["arabic-english", "required", 3]],
      },
    ],
  },
  "ALM-009": {
    slug: "ministry-of-finance",
    type_ar: "وزارة حكومية",
    sector_ar: "المالية العامة",
    city: "Riyadh",
    jobs: [
      {
        title_en: "Financial Analyst", title_ar: "محلل مالي", level: "mid", min_years: 3, category: "finance", work_mode: "onsite",
        description_en: "Analyse budgets and expenditure and build financial models for decisions.",
        description_ar: "تحليل الموازنات والإنفاق وبناء النماذج المالية لدعم القرار.",
        responsibilities_en: ["Analyse budget performance", "Build forecasting models", "Prepare variance reports"],
        responsibilities_ar: ["تحليل أداء الموازنة", "بناء نماذج التنبؤ", "إعداد تقارير الانحرافات"],
        qualifications_en: ["Degree in finance or accounting", "3+ years of financial analysis", "Advanced Excel"],
        qualifications_ar: ["درجة في المالية أو المحاسبة", "خبرة 3 سنوات فأكثر في التحليل المالي", "إتقان Excel"],
        skills: [["financial-analysis", "required", 3], ["budgeting-forecasting", "required", 3], ["financial-modeling", "required", 3], ["excel", "required", 4]],
      },
      {
        title_en: "Accountant", title_ar: "محاسب", level: "junior", min_years: 1, category: "finance", work_mode: "onsite",
        description_en: "Record, reconcile and report financial transactions accurately.",
        description_ar: "تسجيل المعاملات المالية ومطابقتها والإفصاح عنها بدقة.",
        responsibilities_en: ["Prepare reconciliations", "Support period-end closing", "Maintain records"],
        responsibilities_ar: ["إعداد المطابقات", "دعم الإقفال الدوري", "تحديث السجلات"],
        qualifications_en: ["Accounting degree", "IFRS knowledge", "Excel"],
        qualifications_ar: ["درجة في المحاسبة", "معرفة بالمعايير الدولية", "Excel"],
        skills: [["ifrs-accounting", "required", 3], ["excel", "required", 3], ["financial-analysis", "preferred", 2]],
      },
    ],
  },
  "ALM-010": {
    slug: "saudi-industrial-development-fund",
    type_ar: "صندوق تنمية حكومي",
    sector_ar: "التمويل الصناعي",
    city: "Riyadh",
    jobs: [
      {
        title_en: "Credit Analyst", title_ar: "محلل ائتمان", level: "mid", min_years: 3, category: "finance", work_mode: "onsite",
        description_en: "Assess the creditworthiness of industrial financing requests.",
        description_ar: "تقييم الجدارة الائتمانية لطلبات التمويل الصناعي.",
        responsibilities_en: ["Analyse financial statements and cash flows", "Assess project and credit risks", "Write credit recommendations"],
        responsibilities_ar: ["تحليل القوائم المالية والتدفقات النقدية", "تقييم مخاطر المشروع والائتمان", "كتابة التوصيات الائتمانية"],
        qualifications_en: ["Degree in finance", "3+ years of credit analysis", "Financial modeling"],
        qualifications_ar: ["درجة في المالية", "خبرة 3 سنوات فأكثر في التحليل الائتماني", "النمذجة المالية"],
        skills: [["credit-analysis", "required", 4], ["financial-analysis", "required", 3], ["risk-assessment", "required", 3], ["financial-modeling", "preferred", 3]],
      },
      {
        title_en: "Financial Analyst — Industrial Projects", title_ar: "محلل مالي — المشاريع الصناعية", level: "junior", min_years: 1, category: "finance", work_mode: "onsite",
        description_en: "Model the feasibility of industrial projects and summarise key risks.",
        description_ar: "نمذجة الجدوى المالية للمشاريع الصناعية وتلخيص المخاطر الرئيسية.",
        responsibilities_en: ["Build feasibility models", "Run sensitivity analysis", "Summarise results"],
        responsibilities_ar: ["بناء نماذج الجدوى", "إجراء تحليل الحساسية", "تلخيص النتائج"],
        qualifications_en: ["Degree in finance or engineering", "Excel modeling", "Clear writing"],
        qualifications_ar: ["درجة في المالية أو الهندسة", "النمذجة على Excel", "كتابة واضحة"],
        skills: [["financial-modeling", "required", 3], ["financial-analysis", "required", 2], ["excel", "required", 3], ["risk-assessment", "preferred", 2]],
      },
    ],
  },
};

export const TYPE_EN: Record<string, string> = {};
