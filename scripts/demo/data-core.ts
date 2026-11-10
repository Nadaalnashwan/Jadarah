/* Demo data — all companies and people are FICTIONAL. Do not use real organisations or logos. */

export const SKILL_CATEGORIES = [
  ["programming", "Programming", "البرمجة"],
  ["data", "Data", "البيانات"],
  ["ai", "AI & Machine Learning", "الذكاء الاصطناعي وتعلّم الآلة"],
  ["security", "Cybersecurity", "الأمن السيبراني"],
  ["cloud", "Cloud & DevOps", "الحوسبة السحابية وDevOps"],
  ["engineering", "Software Engineering", "هندسة البرمجيات"],
  ["business", "Business & Analysis", "الأعمال والتحليل"],
  ["design", "Design", "التصميم"],
  ["product", "Product", "المنتجات"],
  ["soft", "Professional Skills", "المهارات المهنية"],
] as const;

// slug, en, ar, category, kind
export const SKILLS: [string, string, string, string, string][] = [
  ["python", "Python", "بايثون", "programming", "language"],
  ["javascript", "JavaScript", "جافاسكربت", "programming", "language"],
  ["typescript", "TypeScript", "تايب سكربت", "programming", "language"],
  ["java", "Java", "جافا", "programming", "language"],
  ["csharp", "C#", "سي شارب", "programming", "language"],
  ["go", "Go", "جو", "programming", "language"],
  ["react", "React", "React", "programming", "framework"],
  ["nextjs", "Next.js", "Next.js", "programming", "framework"],
  ["nodejs", "Node.js", "Node.js", "programming", "framework"],
  ["spring", "Spring Boot", "Spring Boot", "programming", "framework"],
  ["dsa", "Data Structures & Algorithms", "هياكل البيانات والخوارزميات", "engineering", "technical"],
  ["sql", "SQL", "SQL", "data", "technical"],
  ["postgresql", "PostgreSQL", "PostgreSQL", "data", "tool"],
  ["data-modeling", "Data Modeling", "نمذجة البيانات", "data", "technical"],
  ["pandas", "pandas", "pandas", "data", "tool"],
  ["excel", "Advanced Excel", "إكسل متقدم", "data", "tool"],
  ["power-bi", "Power BI", "Power BI", "data", "tool"],
  ["tableau", "Tableau", "Tableau", "data", "tool"],
  ["statistics", "Statistics", "الإحصاء", "data", "technical"],
  ["data-visualization", "Data Visualization", "تصوير البيانات", "data", "technical"],
  ["etl", "ETL Pipelines", "خطوط ETL", "data", "technical"],
  ["spark", "Apache Spark", "Apache Spark", "data", "tool"],
  ["airflow", "Apache Airflow", "Apache Airflow", "data", "tool"],
  ["machine-learning", "Machine Learning", "تعلّم الآلة", "ai", "technical"],
  ["deep-learning", "Deep Learning", "التعلّم العميق", "ai", "technical"],
  ["nlp", "Natural Language Processing", "معالجة اللغات الطبيعية", "ai", "technical"],
  ["llm-apps", "LLM Application Development", "تطوير تطبيقات النماذج اللغوية", "ai", "technical"],
  ["scikit-learn", "scikit-learn", "scikit-learn", "ai", "tool"],
  ["pytorch", "PyTorch", "PyTorch", "ai", "framework"],
  ["mlops", "MLOps", "MLOps", "ai", "technical"],
  ["network-security", "Network Security", "أمن الشبكات", "security", "technical"],
  ["siem", "SIEM Operations", "تشغيل SIEM", "security", "tool"],
  ["incident-response", "Incident Response", "الاستجابة للحوادث", "security", "technical"],
  ["threat-analysis", "Threat Analysis", "تحليل التهديدات", "security", "technical"],
  ["owasp", "Web Application Security (OWASP)", "أمن تطبيقات الويب (OWASP)", "security", "technical"],
  ["iam", "Identity & Access Management", "إدارة الهوية والصلاحيات", "security", "technical"],
  ["aws", "AWS", "AWS", "cloud", "tool"],
  ["azure", "Microsoft Azure", "Microsoft Azure", "cloud", "tool"],
  ["docker", "Docker", "Docker", "cloud", "tool"],
  ["kubernetes", "Kubernetes", "Kubernetes", "cloud", "tool"],
  ["terraform", "Terraform", "Terraform", "cloud", "tool"],
  ["ci-cd", "CI/CD", "التكامل والنشر المستمر", "cloud", "technical"],
  ["linux", "Linux", "لينكس", "cloud", "tool"],
  ["git", "Git", "Git", "engineering", "tool"],
  ["testing", "Automated Testing", "الاختبار الآلي", "engineering", "technical"],
  ["system-design", "System Design", "تصميم الأنظمة", "engineering", "technical"],
  ["api-design", "API Design", "تصميم واجهات البرمجة", "engineering", "technical"],
  ["requirements", "Requirements Engineering", "هندسة المتطلبات", "business", "technical"],
  ["process-modeling", "Process Modeling (BPMN)", "نمذجة العمليات (BPMN)", "business", "technical"],
  ["stakeholder-management", "Stakeholder Management", "إدارة أصحاب المصلحة", "business", "soft"],
  ["agile", "Agile & Scrum", "الأجايل وسكرم", "product", "technical"],
  ["product-strategy", "Product Strategy", "استراتيجية المنتج", "product", "technical"],
  ["roadmapping", "Roadmapping", "خرائط الطريق", "product", "technical"],
  ["user-research", "User Research", "أبحاث المستخدمين", "design", "technical"],
  ["ui-design", "UI Design", "تصميم الواجهات", "design", "technical"],
  ["figma", "Figma", "Figma", "design", "tool"],
  ["prototyping", "Prototyping", "النماذج الأولية", "design", "technical"],
  ["accessibility", "Accessibility", "إتاحة الوصول", "design", "technical"],
  ["communication", "Communication", "التواصل", "soft", "soft"],
  ["problem-solving", "Problem Solving", "حل المشكلات", "soft", "soft"],
  ["critical-thinking", "Critical Thinking", "التفكير النقدي", "soft", "soft"],
  ["project-management", "Project Management", "إدارة المشاريع", "business", "technical"],
  ["arabic-english", "Arabic & English Business Writing", "الكتابة المهنية بالعربية والإنجليزية", "soft", "language"],
];

export const JOB_CATEGORIES = [
  ["software", "Software Engineering", "هندسة البرمجيات"],
  ["data", "Data & Analytics", "البيانات والتحليلات"],
  ["ai", "AI & Machine Learning", "الذكاء الاصطناعي"],
  ["security", "Cybersecurity", "الأمن السيبراني"],
  ["cloud", "Cloud & Infrastructure", "السحابة والبنية التحتية"],
  ["business", "Business & Operations", "الأعمال والعمليات"],
  ["design", "Design", "التصميم"],
  ["product", "Product Management", "إدارة المنتجات"],
] as const;

export interface DemoCompany {
  key: string;
  slug: string;
  name_en: string;
  name_ar: string;
  industry: string;
  city: string;
  size: string;
  description_en: string;
  description_ar: string;
  status: "approved" | "pending";
}

export const COMPANIES: DemoCompany[] = [
  { key: "nawat", slug: "nawat-technologies", name_en: "Nawat Technologies", name_ar: "نواة التقنية", industry: "Software", city: "Riyadh", size: "201-500",
    description_en: "A product engineering company building SaaS platforms for government and enterprise clients across the Kingdom.",
    description_ar: "شركة هندسة منتجات تبني منصات برمجية كخدمة للجهات الحكومية والمؤسسات في أنحاء المملكة.", status: "approved" },
  { key: "ofuq", slug: "ofuq-ai", name_en: "Ofuq AI", name_ar: "أفق للذكاء الاصطناعي", industry: "Artificial Intelligence", city: "Riyadh", size: "51-200",
    description_en: "An applied AI lab delivering Arabic-first language and vision solutions.",
    description_ar: "مختبر ذكاء اصطناعي تطبيقي يقدم حلول لغة ورؤية حاسوبية تبدأ بالعربية.", status: "approved" },
  { key: "rakeeza", slug: "rakeeza-finance", name_en: "Rakeeza Finance", name_ar: "ركيزة المالية", industry: "Financial Services", city: "Riyadh", size: "501-1000",
    description_en: "A digital financial services provider focused on SME lending and payments.",
    description_ar: "مزوّد خدمات مالية رقمية يركّز على تمويل المنشآت الصغيرة والمتوسطة والمدفوعات.", status: "approved" },
  { key: "wasl", slug: "wasl-communications", name_en: "Wasl Communications", name_ar: "وصل للاتصالات", industry: "Telecommunications", city: "Jeddah", size: "1000+",
    description_en: "A connectivity provider running fibre, 5G and enterprise network services.",
    description_ar: "مزوّد اتصال يشغّل خدمات الألياف والجيل الخامس وشبكات المؤسسات.", status: "approved" },
  { key: "madar", slug: "madar-consulting", name_en: "Madar Consulting", name_ar: "مدار للاستشارات", industry: "Consulting", city: "Riyadh", size: "51-200",
    description_en: "A management and digital transformation consultancy.",
    description_ar: "دار استشارات في الإدارة والتحول الرقمي.", status: "approved" },
  { key: "nabd", slug: "nabd-healthcare", name_en: "Nabd Healthcare", name_ar: "نبض للرعاية الصحية", industry: "Healthcare", city: "Dammam", size: "501-1000",
    description_en: "A healthcare group digitising patient journeys across clinics and hospitals.",
    description_ar: "مجموعة رعاية صحية ترقمن رحلة المريض عبر العيادات والمستشفيات.", status: "approved" },
  { key: "rawafid", slug: "rawafid-energy", name_en: "Rawafid Energy", name_ar: "روافد للطاقة", industry: "Energy", city: "Dhahran", size: "1000+",
    description_en: "An energy services company investing in industrial data and renewables.",
    description_ar: "شركة خدمات طاقة تستثمر في البيانات الصناعية والطاقة المتجددة.", status: "approved" },
  { key: "souqa", slug: "souqa-digital-commerce", name_en: "Souqa Digital Commerce", name_ar: "سوقة للتجارة الرقمية", industry: "E-commerce", city: "Jeddah", size: "201-500",
    description_en: "A marketplace connecting regional merchants with shoppers nationwide.",
    description_ar: "سوق إلكتروني يربط التجار المحليين بالمتسوقين في جميع أنحاء المملكة.", status: "approved" },
  { key: "haseen", slug: "haseen-cybersecurity", name_en: "Haseen Cybersecurity", name_ar: "حصين للأمن السيبراني", industry: "Cybersecurity", city: "Riyadh", size: "51-200",
    description_en: "A managed security services provider operating a 24/7 security operations centre.",
    description_ar: "مزوّد خدمات أمنية مُدارة يشغّل مركز عمليات أمنية على مدار الساعة.", status: "approved" },
  { key: "imtidad", slug: "imtidad-logistics", name_en: "Imtidad Logistics", name_ar: "امتداد للخدمات اللوجستية", industry: "Logistics", city: "Dammam", size: "201-500",
    description_en: "A logistics operator optimising last-mile delivery with data. Registration under review.",
    description_ar: "مشغّل لوجستي يحسّن التوصيل للميل الأخير بالبيانات. التسجيل قيد المراجعة.", status: "pending" },
];

export interface RoleTemplate {
  key: string;
  category: string;
  title_en: string;
  title_ar: string;
  summary_en: string;
  summary_ar: string;
  responsibilities_en: string[];
  responsibilities_ar: string[];
  qualifications_en: string[];
  qualifications_ar: string[];
  required: [string, number][];
  preferred: [string, number][];
  level: "entry" | "junior" | "mid" | "senior" | "lead";
  min_years: number;
  assessment?: string;
}

export const ROLES: RoleTemplate[] = [
  { key: "fullstack", category: "software", title_en: "Full-Stack Developer", title_ar: "مطوّر برمجيات متكامل",
    summary_en: "build and ship features end to end across a TypeScript web stack", summary_ar: "بناء الميزات وإطلاقها من البداية للنهاية عبر حزمة ويب مبنية على TypeScript",
    responsibilities_en: ["Design and implement product features with React and Node.js", "Write automated tests and review pull requests", "Collaborate with design and product on scope and quality"],
    responsibilities_ar: ["تصميم وتنفيذ ميزات المنتج باستخدام React وNode.js", "كتابة اختبارات آلية ومراجعة طلبات الدمج", "التعاون مع فريقي التصميم والمنتج في النطاق والجودة"],
    qualifications_en: ["Bachelor's in Computer Science or equivalent experience", "Shipped production web applications", "Comfortable with relational databases"],
    qualifications_ar: ["بكالوريوس علوم حاسب أو خبرة مكافئة", "إطلاق تطبيقات ويب في بيئة الإنتاج", "إلمام بقواعد البيانات العلائقية"],
    required: [["typescript", 3], ["react", 3], ["nodejs", 3], ["sql", 3]], preferred: [["nextjs", 3], ["testing", 2], ["docker", 2]], level: "mid", min_years: 2, assessment: "software-engineering" },
  { key: "backend", category: "software", title_en: "Backend Engineer (Java)", title_ar: "مهندس خلفيات (جافا)",
    summary_en: "design reliable services and APIs that handle high transaction volumes", summary_ar: "تصميم خدمات وواجهات برمجية موثوقة تتعامل مع حجم معاملات عالٍ",
    responsibilities_en: ["Build Spring Boot services and REST APIs", "Model data and optimise PostgreSQL queries", "Own service reliability and observability"],
    responsibilities_ar: ["بناء خدمات Spring Boot وواجهات REST", "نمذجة البيانات وتحسين استعلامات PostgreSQL", "تحمّل مسؤولية موثوقية الخدمات ومراقبتها"],
    qualifications_en: ["3+ years of backend development", "Solid understanding of data structures", "Experience with API design"],
    qualifications_ar: ["خبرة 3 سنوات فأكثر في تطوير الخلفيات", "فهم متين لهياكل البيانات", "خبرة في تصميم الواجهات البرمجية"],
    required: [["java", 4], ["spring", 3], ["postgresql", 3], ["api-design", 3]], preferred: [["dsa", 3], ["kubernetes", 2]], level: "mid", min_years: 3, assessment: "dsa" },
  { key: "junior-dev", category: "software", title_en: "Graduate Software Developer", title_ar: "مطوّر برمجيات حديث التخرج",
    summary_en: "grow as an engineer inside a mentored product squad", summary_ar: "النمو كمهندس ضمن فريق منتج مع إرشاد مستمر",
    responsibilities_en: ["Implement well-scoped tickets with guidance", "Learn the codebase, tooling and review culture", "Contribute tests and documentation"],
    responsibilities_ar: ["تنفيذ مهام محددة النطاق بتوجيه", "تعلّم قاعدة الشيفرة والأدوات وثقافة المراجعة", "المساهمة في الاختبارات والتوثيق"],
    qualifications_en: ["Recent graduate in a computing field", "Personal or academic coding projects", "Eagerness to learn"],
    qualifications_ar: ["خريج حديث في تخصص حاسوبي", "مشاريع برمجية شخصية أو أكاديمية", "شغف بالتعلّم"],
    required: [["javascript", 2], ["git", 2], ["problem-solving", 3]], preferred: [["python", 2], ["sql", 2]], level: "entry", min_years: 0, assessment: "programming-fundamentals" },
  { key: "data-analyst", category: "data", title_en: "Data Analyst", title_ar: "محلل بيانات",
    summary_en: "turn operational data into decisions leadership can act on", summary_ar: "تحويل البيانات التشغيلية إلى قرارات تستطيع الإدارة تنفيذها",
    responsibilities_en: ["Write SQL to answer business questions", "Build and maintain Power BI dashboards", "Present findings to non-technical stakeholders"],
    responsibilities_ar: ["كتابة استعلامات SQL للإجابة عن أسئلة الأعمال", "بناء لوحات Power BI وصيانتها", "عرض النتائج على أصحاب مصلحة غير تقنيين"],
    qualifications_en: ["Degree in statistics, IS, engineering or related", "Strong SQL and spreadsheet skills", "Clear written communication"],
    qualifications_ar: ["شهادة في الإحصاء أو نظم المعلومات أو الهندسة أو ما يماثلها", "مهارات قوية في SQL والجداول الإلكترونية", "تواصل كتابي واضح"],
    required: [["sql", 3], ["power-bi", 3], ["statistics", 2], ["communication", 3]], preferred: [["python", 2], ["excel", 3]], level: "junior", min_years: 1, assessment: "data-analysis" },
  { key: "data-engineer", category: "data", title_en: "Data Engineer", title_ar: "مهندس بيانات",
    summary_en: "build the pipelines and models that every analytics product depends on", summary_ar: "بناء خطوط البيانات والنماذج التي تعتمد عليها منتجات التحليلات",
    responsibilities_en: ["Build batch and streaming ETL pipelines", "Model warehouse tables for analytics", "Orchestrate jobs with Airflow and monitor data quality"],
    responsibilities_ar: ["بناء خطوط ETL دفعية وتدفقية", "نمذجة جداول المستودع للتحليلات", "جدولة المهام بـ Airflow ومراقبة جودة البيانات"],
    qualifications_en: ["2+ years in data engineering", "Python and SQL proficiency", "Experience with a cloud data platform"],
    qualifications_ar: ["خبرة سنتين فأكثر في هندسة البيانات", "إتقان بايثون وSQL", "خبرة في منصة بيانات سحابية"],
    required: [["python", 3], ["sql", 4], ["etl", 3], ["data-modeling", 3]], preferred: [["spark", 2], ["airflow", 2], ["aws", 2]], level: "mid", min_years: 2, assessment: "sql-database-design" },
  { key: "ml-engineer", category: "ai", title_en: "Machine Learning Engineer", title_ar: "مهندس تعلّم آلة",
    summary_en: "take models from notebook to monitored production service", summary_ar: "نقل النماذج من دفاتر التجارب إلى خدمات إنتاج مراقَبة",
    responsibilities_en: ["Train, evaluate and deploy ML models", "Build feature pipelines and model monitoring", "Partner with product on measurable outcomes"],
    responsibilities_ar: ["تدريب نماذج تعلّم الآلة وتقييمها ونشرها", "بناء خطوط الخصائص ومراقبة النماذج", "الشراكة مع فريق المنتج لتحقيق نتائج قابلة للقياس"],
    qualifications_en: ["Strong Python and ML fundamentals", "Experience deploying models", "Understanding of evaluation metrics"],
    qualifications_ar: ["أساسيات قوية في بايثون وتعلّم الآلة", "خبرة في نشر النماذج", "فهم مقاييس التقييم"],
    required: [["python", 4], ["machine-learning", 3], ["scikit-learn", 3], ["mlops", 2]], preferred: [["pytorch", 2], ["docker", 2]], level: "mid", min_years: 2, assessment: "machine-learning" },
  { key: "ai-engineer", category: "ai", title_en: "AI Engineer (LLM Applications)", title_ar: "مهندس ذكاء اصطناعي (تطبيقات النماذج اللغوية)",
    summary_en: "build reliable Arabic-first applications on large language models", summary_ar: "بناء تطبيقات موثوقة تبدأ بالعربية فوق النماذج اللغوية الكبيرة",
    responsibilities_en: ["Design retrieval and prompt pipelines", "Evaluate model quality, safety and cost", "Ship AI features behind clear human controls"],
    responsibilities_ar: ["تصميم خطوط الاسترجاع والتلقين", "تقييم جودة النماذج وأمانها وتكلفتها", "إطلاق ميزات ذكاء اصطناعي مع ضوابط بشرية واضحة"],
    qualifications_en: ["Python engineering experience", "Hands-on work with LLM APIs", "NLP background, Arabic a plus"],
    qualifications_ar: ["خبرة هندسية في بايثون", "عمل تطبيقي مع واجهات النماذج اللغوية", "خلفية في معالجة اللغات، والعربية ميزة"],
    required: [["python", 3], ["llm-apps", 3], ["nlp", 3], ["api-design", 2]], preferred: [["deep-learning", 2], ["mlops", 2]], level: "mid", min_years: 2, assessment: "ai-fundamentals" },
  { key: "soc-analyst", category: "security", title_en: "SOC Analyst", title_ar: "محلل مركز العمليات الأمنية",
    summary_en: "detect, triage and respond to threats in a 24/7 SOC", summary_ar: "رصد التهديدات وفرزها والاستجابة لها في مركز عمليات أمنية يعمل على مدار الساعة",
    responsibilities_en: ["Monitor SIEM alerts and triage incidents", "Investigate suspicious activity and document findings", "Escalate and coordinate incident response"],
    responsibilities_ar: ["مراقبة تنبيهات SIEM وفرز الحوادث", "التحقيق في الأنشطة المشبوهة وتوثيق النتائج", "تصعيد الاستجابة للحوادث وتنسيقها"],
    qualifications_en: ["Networking and security fundamentals", "Familiarity with SIEM tools", "Willingness to work shifts"],
    qualifications_ar: ["أساسيات الشبكات والأمن", "إلمام بأدوات SIEM", "استعداد للعمل بنظام المناوبات"],
    required: [["network-security", 3], ["siem", 2], ["incident-response", 2], ["linux", 2]], preferred: [["threat-analysis", 2]], level: "junior", min_years: 1, assessment: "cybersecurity-fundamentals" },
  { key: "appsec", category: "security", title_en: "Application Security Engineer", title_ar: "مهندس أمن التطبيقات",
    summary_en: "embed security into how product teams design and ship software", summary_ar: "دمج الأمن في طريقة تصميم فرق المنتج للبرمجيات وإطلاقها",
    responsibilities_en: ["Run threat modelling and secure design reviews", "Triage findings from SAST/DAST", "Coach engineers on OWASP risks"],
    responsibilities_ar: ["إجراء نمذجة التهديدات ومراجعات التصميم الآمن", "فرز نتائج أدوات الفحص الساكن والديناميكي", "توجيه المهندسين حول مخاطر OWASP"],
    qualifications_en: ["Software development background", "Deep knowledge of web vulnerabilities", "Clear communication"],
    qualifications_ar: ["خلفية في تطوير البرمجيات", "معرفة عميقة بثغرات الويب", "تواصل واضح"],
    required: [["owasp", 4], ["javascript", 2], ["threat-analysis", 3], ["iam", 2]], preferred: [["ci-cd", 2]], level: "senior", min_years: 4, assessment: "network-security" },
  { key: "cloud-engineer", category: "cloud", title_en: "Cloud Engineer", title_ar: "مهندس سحابة",
    summary_en: "run secure, automated cloud infrastructure at scale", summary_ar: "تشغيل بنية سحابية آمنة ومؤتمتة على نطاق واسع",
    responsibilities_en: ["Provision infrastructure with Terraform", "Operate Kubernetes workloads", "Build CI/CD pipelines and improve reliability"],
    responsibilities_ar: ["تجهيز البنية التحتية باستخدام Terraform", "تشغيل أحمال Kubernetes", "بناء خطوط CI/CD وتحسين الموثوقية"],
    qualifications_en: ["2+ years operating cloud infrastructure", "Linux administration", "A cloud certification is a plus"],
    qualifications_ar: ["خبرة سنتين فأكثر في تشغيل بنية سحابية", "إدارة أنظمة لينكس", "الشهادة السحابية ميزة"],
    required: [["aws", 3], ["terraform", 3], ["kubernetes", 3], ["linux", 3]], preferred: [["ci-cd", 3], ["azure", 2]], level: "mid", min_years: 2, assessment: "software-engineering" },
  { key: "business-analyst", category: "business", title_en: "Business Analyst", title_ar: "محلل أعمال",
    summary_en: "translate business needs into clear, testable requirements", summary_ar: "ترجمة احتياجات الأعمال إلى متطلبات واضحة قابلة للاختبار",
    responsibilities_en: ["Run discovery workshops with stakeholders", "Model current and future processes", "Write user stories and acceptance criteria"],
    responsibilities_ar: ["إدارة ورش الاستكشاف مع أصحاب المصلحة", "نمذجة العمليات الحالية والمستقبلية", "كتابة قصص المستخدمين ومعايير القبول"],
    qualifications_en: ["Degree in business, IS or engineering", "Requirements documentation experience", "Bilingual Arabic/English writing"],
    qualifications_ar: ["شهادة في الأعمال أو نظم المعلومات أو الهندسة", "خبرة في توثيق المتطلبات", "كتابة ثنائية اللغة عربية/إنجليزية"],
    required: [["requirements", 3], ["process-modeling", 3], ["stakeholder-management", 3], ["communication", 3]], preferred: [["sql", 2], ["agile", 2]], level: "junior", min_years: 1, assessment: "business-analysis" },
  { key: "product-manager", category: "product", title_en: "Product Manager", title_ar: "مدير منتج",
    summary_en: "own outcomes for a customer-facing product area", summary_ar: "تحمّل مسؤولية النتائج لمجال منتج يخدم العملاء",
    responsibilities_en: ["Define strategy and a measurable roadmap", "Prioritise with engineering and design", "Use research and data to decide"],
    responsibilities_ar: ["تحديد الاستراتيجية وخريطة طريق قابلة للقياس", "ترتيب الأولويات مع الهندسة والتصميم", "الاعتماد على الأبحاث والبيانات في القرار"],
    qualifications_en: ["3+ years in product or adjacent roles", "Evidence of shipped outcomes", "Strong communication"],
    qualifications_ar: ["خبرة 3 سنوات فأكثر في المنتجات أو أدوار قريبة", "دليل على نتائج تم إطلاقها", "تواصل قوي"],
    required: [["product-strategy", 3], ["roadmapping", 3], ["agile", 3], ["stakeholder-management", 3]], preferred: [["user-research", 2], ["sql", 2]], level: "senior", min_years: 3, assessment: "project-management" },
  { key: "ux-designer", category: "design", title_en: "UI/UX Designer", title_ar: "مصمم واجهات وتجربة مستخدم",
    summary_en: "design accessible bilingual experiences from research to polished UI", summary_ar: "تصميم تجارب ثنائية اللغة ومتاحة للجميع من البحث حتى الواجهة النهائية",
    responsibilities_en: ["Conduct user research and usability tests", "Design flows and high-fidelity UI in Figma", "Maintain the design system for RTL and LTR"],
    responsibilities_ar: ["إجراء أبحاث المستخدمين واختبارات قابلية الاستخدام", "تصميم المسارات والواجهات عالية الدقة في Figma", "صيانة نظام التصميم للاتجاهين"],
    qualifications_en: ["Portfolio of shipped product design", "Experience designing for Arabic", "Accessibility awareness"],
    qualifications_ar: ["ملف أعمال لتصاميم منتجات مُطلقة", "خبرة في التصميم للعربية", "وعي بإتاحة الوصول"],
    required: [["figma", 3], ["ui-design", 3], ["user-research", 2], ["prototyping", 3]], preferred: [["accessibility", 2]], level: "mid", min_years: 2, assessment: "communication-skills" },
  { key: "pm-delivery", category: "business", title_en: "Project Manager", title_ar: "مدير مشروع",
    summary_en: "deliver digital transformation programmes on time and on scope", summary_ar: "تسليم برامج التحول الرقمي في الوقت والنطاق المحددين",
    responsibilities_en: ["Plan and track delivery milestones", "Manage risks, dependencies and budget", "Report status to executives"],
    responsibilities_ar: ["تخطيط مراحل التسليم ومتابعتها", "إدارة المخاطر والاعتماديات والميزانية", "رفع تقارير الحالة إلى القيادة"],
    qualifications_en: ["4+ years managing projects", "PMP or similar is a plus", "Excellent stakeholder communication"],
    qualifications_ar: ["خبرة 4 سنوات فأكثر في إدارة المشاريع", "شهادة PMP أو ما يماثلها ميزة", "تواصل ممتاز مع أصحاب المصلحة"],
    required: [["project-management", 4], ["stakeholder-management", 3], ["agile", 3]], preferred: [["communication", 4]], level: "senior", min_years: 4, assessment: "project-management" },
  { key: "data-scientist", category: "ai", title_en: "Data Scientist", title_ar: "عالم بيانات",
    summary_en: "use statistics and ML to answer questions that move the business", summary_ar: "استخدام الإحصاء وتعلّم الآلة للإجابة عن أسئلة تحرّك الأعمال",
    responsibilities_en: ["Frame problems and design experiments", "Build predictive models in Python", "Communicate uncertainty honestly"],
    responsibilities_ar: ["صياغة المشكلات وتصميم التجارب", "بناء نماذج تنبؤية ببايثون", "توضيح عدم اليقين بأمانة"],
    qualifications_en: ["Degree in a quantitative field", "Python, pandas and statistics", "Experience presenting analyses"],
    qualifications_ar: ["شهادة في تخصص كمي", "بايثون وpandas والإحصاء", "خبرة في عرض التحليلات"],
    required: [["python", 3], ["pandas", 3], ["statistics", 3], ["machine-learning", 2]], preferred: [["sql", 3], ["data-visualization", 2]], level: "mid", min_years: 2, assessment: "python-data-science" },
];

/** Which roles each company hires for (3 per company → 30 jobs). */
export const COMPANY_ROLES: Record<string, { role: string; status: "published" | "draft" | "closed" | "paused"; mode: "onsite" | "remote" | "hybrid" }[]> = {
  nawat: [{ role: "fullstack", status: "published", mode: "hybrid" }, { role: "junior-dev", status: "published", mode: "onsite" }, { role: "cloud-engineer", status: "published", mode: "hybrid" }],
  ofuq: [{ role: "ai-engineer", status: "published", mode: "hybrid" }, { role: "ml-engineer", status: "published", mode: "remote" }, { role: "data-scientist", status: "draft", mode: "hybrid" }],
  rakeeza: [{ role: "backend", status: "published", mode: "onsite" }, { role: "data-analyst", status: "published", mode: "hybrid" }, { role: "appsec", status: "published", mode: "onsite" }],
  wasl: [{ role: "cloud-engineer", status: "published", mode: "onsite" }, { role: "soc-analyst", status: "published", mode: "onsite" }, { role: "data-engineer", status: "closed", mode: "hybrid" }],
  madar: [{ role: "business-analyst", status: "published", mode: "hybrid" }, { role: "pm-delivery", status: "published", mode: "onsite" }, { role: "product-manager", status: "published", mode: "hybrid" }],
  nabd: [{ role: "data-analyst", status: "published", mode: "onsite" }, { role: "ux-designer", status: "published", mode: "hybrid" }, { role: "business-analyst", status: "paused", mode: "onsite" }],
  rawafid: [{ role: "data-engineer", status: "published", mode: "onsite" }, { role: "data-scientist", status: "published", mode: "hybrid" }, { role: "project-management-placeholder", status: "published", mode: "onsite" }],
  souqa: [{ role: "fullstack", status: "published", mode: "remote" }, { role: "product-manager", status: "published", mode: "hybrid" }, { role: "ux-designer", status: "published", mode: "remote" }],
  haseen: [{ role: "soc-analyst", status: "published", mode: "onsite" }, { role: "appsec", status: "published", mode: "hybrid" }, { role: "junior-dev", status: "published", mode: "onsite" }],
  imtidad: [{ role: "data-analyst", status: "draft", mode: "onsite" }, { role: "backend", status: "draft", mode: "hybrid" }, { role: "pm-delivery", status: "draft", mode: "onsite" }],
};
COMPANY_ROLES.rawafid[2].role = "pm-delivery";

export const SALARY_BANDS: Record<string, [number, number]> = {
  entry: [8000, 11000], junior: [10000, 14000], mid: [15000, 22000], senior: [22000, 32000], lead: [30000, 42000],
};
