/* 15 platform library assessments. Objective items carry answer keys; open items use rubrics + human review. */
export type Q =
  | {
      t: "multiple_choice" | "true_false" | "multiple_select";
      en: string;
      ar: string;
      pts: number;
      opts: [string, string, boolean][];
      why_en?: string;
      why_ar?: string;
    }
  | {
      t: "short_answer";
      en: string;
      ar: string;
      pts: number;
      accepted: string[];
      why_en?: string;
      why_ar?: string;
    }
  | {
      t: "long_answer" | "coding" | "sql" | "case_study";
      en: string;
      ar: string;
      pts: number;
      config?: Record<string, unknown>;
      rubric: true;
    };

export interface DemoAssessment {
  slug: string;
  title_en: string;
  title_ar: string;
  desc_en: string;
  desc_ar: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  minutes: number;
  outcomes_en: string[];
  outcomes_ar: string[];
  q: Q[];
}

const TF = (correct: boolean): [string, string, boolean][] => [
  ["True", "صحيح", correct],
  ["False", "خطأ", !correct],
];

/** Shared rubric used for open responses (5 criteria × up to 2 points, scaled to question points by reviewers). */
export const OPEN_RUBRIC = [
  {
    key: "correctness",
    name_en: "Correctness",
    name_ar: "الصحة",
    max_points: 4,
    description_en: "The solution or argument is right and complete.",
    description_ar: "الحل أو الحجة صحيحة ومكتملة.",
  },
  {
    key: "reasoning",
    name_en: "Reasoning",
    name_ar: "الاستدلال",
    max_points: 3,
    description_en: "Trade-offs and assumptions are explained.",
    description_ar: "شرح المفاضلات والافتراضات.",
  },
  {
    key: "clarity",
    name_en: "Clarity",
    name_ar: "الوضوح",
    max_points: 3,
    description_en: "Structured, readable, and concise.",
    description_ar: "منظّم ومقروء وموجز.",
  },
];

export const ASSESSMENTS: DemoAssessment[] = [
  {
    slug: "programming-fundamentals",
    title_en: "Programming Fundamentals",
    title_ar: "أساسيات البرمجة",
    desc_en: "Variables, control flow, functions and debugging.",
    desc_ar: "المتغيرات والتحكم بالتدفق والدوال وتصحيح الأخطاء.",
    category: "programming",
    difficulty: "beginner",
    minutes: 25,
    outcomes_en: [
      "Trace program execution",
      "Choose appropriate control structures",
      "Write small, correct functions",
    ],
    outcomes_ar: ["تتبّع تنفيذ البرنامج", "اختيار بنى التحكم المناسبة", "كتابة دوال صغيرة صحيحة"],
    q: [
      {
        t: "multiple_choice",
        en: "What does `len([3, 1, 4])` return in Python?",
        ar: "ماذا تُرجع `len([3, 1, 4])` في بايثون؟",
        pts: 2,
        opts: [
          ["3", "3", true],
          ["4", "4", false],
          ["8", "8", false],
          ["An error", "خطأ", false],
        ],
      },
      {
        t: "true_false",
        en: "A `while` loop always executes its body at least once.",
        ar: "حلقة `while` تنفّذ جسمها مرة واحدة على الأقل دائمًا.",
        pts: 1,
        opts: TF(false),
        why_en: "The condition is checked before the first iteration.",
        why_ar: "يُفحص الشرط قبل التكرار الأول.",
      },
      {
        t: "multiple_select",
        en: "Which are immutable types in Python?",
        ar: "أيّ مما يلي أنواع غير قابلة للتعديل في بايثون؟",
        pts: 3,
        opts: [
          ["tuple", "tuple", true],
          ["str", "str", true],
          ["list", "list", false],
          ["dict", "dict", false],
        ],
      },
      {
        t: "short_answer",
        en: "What keyword returns a value from a Python function?",
        ar: "ما الكلمة المفتاحية التي تُرجع قيمة من دالة بايثون؟",
        pts: 2,
        accepted: ["return"],
      },
      {
        t: "coding",
        en: "Write a function `is_palindrome(s)` that ignores case and spaces. Explain its complexity.",
        ar: "اكتب دالة `is_palindrome(s)` تتجاهل حالة الأحرف والمسافات، واشرح تعقيدها.",
        pts: 10,
        config: { language: "python", starter: "def is_palindrome(s: str) -> bool:\n    ..." },
        rubric: true,
      },
    ],
  },
  {
    slug: "dsa",
    title_en: "Data Structures and Algorithms",
    title_ar: "هياكل البيانات والخوارزميات",
    desc_en: "Complexity, core structures and algorithmic trade-offs.",
    desc_ar: "التعقيد والهياكل الأساسية ومفاضلات الخوارزميات.",
    category: "programming",
    difficulty: "intermediate",
    minutes: 40,
    outcomes_en: [
      "Analyse time and space complexity",
      "Pick structures for access patterns",
      "Design efficient algorithms",
    ],
    outcomes_ar: [
      "تحليل التعقيد الزمني والمكاني",
      "اختيار الهياكل حسب أنماط الوصول",
      "تصميم خوارزميات فعّالة",
    ],
    q: [
      {
        t: "multiple_choice",
        en: "Average lookup time in a hash map is…",
        ar: "متوسط زمن البحث في جدول التجزئة هو…",
        pts: 2,
        opts: [
          ["O(1)", "O(1)", true],
          ["O(log n)", "O(log n)", false],
          ["O(n)", "O(n)", false],
          ["O(n log n)", "O(n log n)", false],
        ],
      },
      {
        t: "multiple_choice",
        en: "Which structure gives FIFO order?",
        ar: "أي هيكل يعطي ترتيب الداخل أولًا يخرج أولًا؟",
        pts: 2,
        opts: [
          ["Queue", "الطابور", true],
          ["Stack", "المكدّس", false],
          ["Heap", "الكومة", false],
          ["Set", "المجموعة", false],
        ],
      },
      {
        t: "true_false",
        en: "Binary search requires sorted input.",
        ar: "البحث الثنائي يتطلب مدخلات مرتّبة.",
        pts: 1,
        opts: TF(true),
      },
      {
        t: "multiple_select",
        en: "Which sorts are O(n log n) in the worst case?",
        ar: "أي خوارزميات الفرز تكون O(n log n) في أسوأ الحالات؟",
        pts: 3,
        opts: [
          ["Merge sort", "الفرز بالدمج", true],
          ["Heap sort", "الفرز بالكومة", true],
          ["Quick sort", "الفرز السريع", false],
          ["Bubble sort", "الفرز الفقاعي", false],
        ],
      },
      {
        t: "coding",
        en: "Return the k most frequent elements of an integer array. State your complexity.",
        ar: "أرجِع العناصر الأكثر تكرارًا بعدد k من مصفوفة أعداد صحيحة، مع ذكر التعقيد.",
        pts: 12,
        config: { language: "python" },
        rubric: true,
      },
    ],
  },
  {
    slug: "sql-database-design",
    title_en: "SQL and Database Design",
    title_ar: "SQL وتصميم قواعد البيانات",
    desc_en: "Querying, joins, normalisation and indexing.",
    desc_ar: "الاستعلام والربط والتطبيع والفهرسة.",
    category: "data",
    difficulty: "intermediate",
    minutes: 35,
    outcomes_en: ["Write correct joins and aggregates", "Normalise a schema", "Reason about indexes"],
    outcomes_ar: ["كتابة عمليات ربط وتجميع صحيحة", "تطبيع مخطط قاعدة بيانات", "التفكير في الفهارس"],
    q: [
      {
        t: "multiple_choice",
        en: "Which join returns all rows from the left table?",
        ar: "أي ربط يُرجع كل صفوف الجدول الأيسر؟",
        pts: 2,
        opts: [
          ["LEFT JOIN", "LEFT JOIN", true],
          ["INNER JOIN", "INNER JOIN", false],
          ["CROSS JOIN", "CROSS JOIN", false],
          ["SEMI JOIN", "SEMI JOIN", false],
        ],
      },
      {
        t: "true_false",
        en: "`WHERE` filters rows after `GROUP BY` aggregation.",
        ar: "`WHERE` يصفّي الصفوف بعد تجميع `GROUP BY`.",
        pts: 1,
        opts: TF(false),
        why_en: "HAVING filters after aggregation.",
        why_ar: "HAVING هي التي تصفّي بعد التجميع.",
      },
      {
        t: "multiple_select",
        en: "Good candidates for an index:",
        ar: "مرشحات جيدة للفهرسة:",
        pts: 3,
        opts: [
          ["Foreign keys used in joins", "المفاتيح الأجنبية المستخدمة في الربط", true],
          ["Columns in frequent WHERE filters", "أعمدة في شروط WHERE المتكررة", true],
          ["A boolean column with two values on a tiny table", "عمود منطقي بقيمتين في جدول صغير جدًا", false],
        ],
      },
      {
        t: "short_answer",
        en: "Which SQL clause removes duplicate rows from a result?",
        ar: "أي عبارة SQL تزيل الصفوف المكررة من النتيجة؟",
        pts: 2,
        accepted: ["distinct", "select distinct"],
      },
      {
        t: "sql",
        en: "Tables: orders(id, customer_id, total, created_at), customers(id, city). Write a query for monthly revenue per city in 2026.",
        ar: "الجداول: orders(id, customer_id, total, created_at) و customers(id, city). اكتب استعلامًا للإيراد الشهري لكل مدينة في 2026.",
        pts: 10,
        config: { dialect: "postgresql" },
        rubric: true,
      },
    ],
  },
  {
    slug: "data-analysis",
    title_en: "Data Analysis",
    title_ar: "تحليل البيانات",
    desc_en: "Descriptive statistics, visual choices and insight communication.",
    desc_ar: "الإحصاء الوصفي واختيار المرئيات وإيصال الرؤى.",
    category: "data",
    difficulty: "beginner",
    minutes: 30,
    outcomes_en: ["Summarise data correctly", "Choose the right chart", "Communicate insight and caveats"],
    outcomes_ar: ["تلخيص البيانات بشكل صحيح", "اختيار المخطط المناسب", "إيصال الرؤية والتحفظات"],
    q: [
      {
        t: "multiple_choice",
        en: "Which measure is most robust to outliers?",
        ar: "أي مقياس أكثر مقاومة للقيم المتطرفة؟",
        pts: 2,
        opts: [
          ["Median", "الوسيط", true],
          ["Mean", "المتوسط", false],
          ["Range", "المدى", false],
          ["Variance", "التباين", false],
        ],
      },
      {
        t: "multiple_choice",
        en: "Best chart to show a trend over 12 months:",
        ar: "أفضل مخطط لعرض اتجاه خلال 12 شهرًا:",
        pts: 2,
        opts: [
          ["Line chart", "مخطط خطي", true],
          ["Pie chart", "مخطط دائري", false],
          ["Scatter of categories", "مخطط تبعثر للفئات", false],
        ],
      },
      {
        t: "true_false",
        en: "Correlation implies causation.",
        ar: "الارتباط يعني السببية.",
        pts: 1,
        opts: TF(false),
      },
      {
        t: "short_answer",
        en: "What is the median of 3, 9, 4, 7, 5?",
        ar: "ما وسيط الأعداد 3، 9، 4، 7، 5؟",
        pts: 2,
        accepted: ["5"],
      },
      {
        t: "case_study",
        en: "Clinic no-show rates rose from 8% to 14% in a quarter. Outline the analysis you would run and how you'd present it to operations leaders.",
        ar: "ارتفع معدل عدم حضور المواعيد في العيادات من 8٪ إلى 14٪ خلال ربع سنة. اشرح التحليل الذي ستجريه وكيف ستعرضه على قادة العمليات.",
        pts: 10,
        rubric: true,
      },
    ],
  },
  {
    slug: "python-data-science",
    title_en: "Python for Data Science",
    title_ar: "بايثون لعلم البيانات",
    desc_en: "pandas, NumPy and reproducible analysis.",
    desc_ar: "pandas وNumPy والتحليل القابل لإعادة الإنتاج.",
    category: "data",
    difficulty: "intermediate",
    minutes: 35,
    outcomes_en: ["Manipulate DataFrames", "Handle missing data", "Write reproducible notebooks"],
    outcomes_ar: ["معالجة أطر البيانات", "التعامل مع البيانات المفقودة", "كتابة دفاتر قابلة لإعادة الإنتاج"],
    q: [
      {
        t: "multiple_choice",
        en: "Which pandas method groups rows for aggregation?",
        ar: "أي دالة في pandas تجمع الصفوف للتجميع؟",
        pts: 2,
        opts: [
          ["groupby", "groupby", true],
          ["pivot_wider", "pivot_wider", false],
          ["aggregate_by", "aggregate_by", false],
        ],
      },
      {
        t: "multiple_select",
        en: "Valid ways to handle missing values:",
        ar: "طرق صحيحة للتعامل مع القيم المفقودة:",
        pts: 3,
        opts: [
          ["dropna()", "dropna()", true],
          ["fillna()", "fillna()", true],
          [
            "Silently ignoring them in averages without checking",
            "تجاهلها بصمت في المتوسطات دون تحقق",
            false,
          ],
        ],
      },
      {
        t: "true_false",
        en: "NumPy array operations are usually faster than Python loops.",
        ar: "عمليات مصفوفات NumPy أسرع عادةً من حلقات بايثون.",
        pts: 1,
        opts: TF(true),
      },
      {
        t: "short_answer",
        en: "Which pandas function reads a CSV file?",
        ar: "ما دالة pandas التي تقرأ ملف CSV؟",
        pts: 2,
        accepted: ["read_csv", "pd.read_csv", "pandas.read_csv"],
      },
      {
        t: "coding",
        en: "Given a DataFrame `sales(date, branch, amount)`, compute each branch's 7-day rolling average and flag days 30% below it.",
        ar: "لديك إطار بيانات `sales(date, branch, amount)`. احسب المتوسط المتحرك لسبعة أيام لكل فرع وعلّم الأيام التي تقل عنه بـ 30٪.",
        pts: 10,
        config: { language: "python" },
        rubric: true,
      },
    ],
  },
  {
    slug: "ai-fundamentals",
    title_en: "AI Fundamentals",
    title_ar: "أساسيات الذكاء الاصطناعي",
    desc_en: "Core AI concepts, LLM behaviour and responsible use.",
    desc_ar: "مفاهيم الذكاء الاصطناعي الأساسية وسلوك النماذج اللغوية والاستخدام المسؤول.",
    category: "ai",
    difficulty: "beginner",
    minutes: 25,
    outcomes_en: ["Explain how LLMs generate text", "Identify AI risks", "Apply human oversight"],
    outcomes_ar: [
      "شرح كيفية توليد النماذج اللغوية للنص",
      "تحديد مخاطر الذكاء الاصطناعي",
      "تطبيق الرقابة البشرية",
    ],
    q: [
      {
        t: "multiple_choice",
        en: "An LLM 'hallucination' is…",
        ar: '"هلوسة" النموذج اللغوي هي…',
        pts: 2,
        opts: [
          ["A fluent but unsupported or false output", "مخرجات سلسة لكنها غير مدعومة أو خاطئة", true],
          ["A GPU failure", "عطل في المعالج الرسومي", false],
          ["A tokenizer bug", "خلل في المُرمِّز", false],
        ],
      },
      {
        t: "true_false",
        en: "Retrieval-augmented generation can ground answers in specific documents.",
        ar: "التوليد المعزّز بالاسترجاع يمكنه تأسيس الإجابات على وثائق محددة.",
        pts: 1,
        opts: TF(true),
      },
      {
        t: "multiple_select",
        en: "Good practices for AI in hiring:",
        ar: "ممارسات جيدة للذكاء الاصطناعي في التوظيف:",
        pts: 3,
        opts: [
          ["Explain recommendations", "تفسير التوصيات", true],
          ["Keep a human decision-maker", "إبقاء صانع قرار بشري", true],
          ["Auto-reject candidates by score", "الرفض الآلي للمرشحين حسب الدرجة", false],
        ],
      },
      {
        t: "short_answer",
        en: "What is the unit of text an LLM processes called?",
        ar: "ما اسم وحدة النص التي يعالجها النموذج اللغوي؟",
        pts: 2,
        accepted: ["token", "tokens", "رمز", "توكن"],
      },
      {
        t: "long_answer",
        en: "Describe how you would evaluate an Arabic customer-support chatbot before launch.",
        ar: "صف كيف ستقيّم روبوت محادثة لدعم العملاء بالعربية قبل إطلاقه.",
        pts: 10,
        rubric: true,
      },
    ],
  },
  {
    slug: "machine-learning",
    title_en: "Machine Learning",
    title_ar: "تعلّم الآلة",
    desc_en: "Model selection, evaluation and overfitting.",
    desc_ar: "اختيار النماذج وتقييمها والإفراط في التعلّم.",
    category: "ai",
    difficulty: "advanced",
    minutes: 40,
    outcomes_en: ["Select evaluation metrics", "Diagnose over/underfitting", "Design a training pipeline"],
    outcomes_ar: ["اختيار مقاييس التقييم", "تشخيص الإفراط والقصور في التعلّم", "تصميم خط تدريب"],
    q: [
      {
        t: "multiple_choice",
        en: "For a fraud dataset with 1% positives, which metric is most informative?",
        ar: "لبيانات احتيال فيها 1٪ حالات إيجابية، أي مقياس هو الأكثر إفادة؟",
        pts: 2,
        opts: [
          ["Precision-recall AUC", "مساحة منحنى الدقة والاستدعاء", true],
          ["Accuracy", "الدقة الكلية", false],
          ["Mean squared error", "متوسط مربع الخطأ", false],
        ],
      },
      {
        t: "true_false",
        en: "High training accuracy with low validation accuracy suggests overfitting.",
        ar: "دقة تدريب عالية مع دقة تحقق منخفضة تشير إلى الإفراط في التعلّم.",
        pts: 1,
        opts: TF(true),
      },
      {
        t: "multiple_select",
        en: "Techniques that reduce overfitting:",
        ar: "أساليب تقلل الإفراط في التعلّم:",
        pts: 3,
        opts: [
          ["Regularisation", "التنظيم", true],
          ["More training data", "بيانات تدريب أكثر", true],
          ["Training longer without validation", "التدريب لفترة أطول دون تحقق", false],
        ],
      },
      {
        t: "short_answer",
        en: "Name the technique of splitting data into k folds for validation.",
        ar: "ما اسم أسلوب تقسيم البيانات إلى k أجزاء للتحقق؟",
        pts: 2,
        accepted: [
          "cross-validation",
          "cross validation",
          "k-fold cross-validation",
          "k-fold",
          "التحقق المتقاطع",
        ],
      },
      {
        t: "case_study",
        en: "Design a churn-prediction model for a telecom: features, validation, deployment and monitoring.",
        ar: "صمّم نموذجًا للتنبؤ بتسرّب العملاء لشركة اتصالات: الخصائص والتحقق والنشر والمراقبة.",
        pts: 12,
        rubric: true,
      },
    ],
  },
  {
    slug: "cybersecurity-fundamentals",
    title_en: "Cybersecurity Fundamentals",
    title_ar: "أساسيات الأمن السيبراني",
    desc_en: "CIA triad, common attacks and defensive controls.",
    desc_ar: "ثالوث السرية والسلامة والإتاحة والهجمات الشائعة والضوابط الدفاعية.",
    category: "security",
    difficulty: "beginner",
    minutes: 25,
    outcomes_en: ["Explain core security principles", "Recognise common attacks", "Apply basic controls"],
    outcomes_ar: ["شرح مبادئ الأمن الأساسية", "التعرّف على الهجمات الشائعة", "تطبيق الضوابط الأساسية"],
    q: [
      {
        t: "multiple_choice",
        en: "Phishing primarily targets…",
        ar: "يستهدف التصيّد الاحتيالي أساسًا…",
        pts: 2,
        opts: [
          ["People", "الأشخاص", true],
          ["Firewalls", "الجدران النارية", false],
          ["DNS servers only", "خوادم DNS فقط", false],
        ],
      },
      {
        t: "true_false",
        en: "MFA significantly reduces account takeover risk.",
        ar: "التحقق متعدد العوامل يقلل بشكل كبير خطر الاستيلاء على الحسابات.",
        pts: 1,
        opts: TF(true),
      },
      {
        t: "multiple_select",
        en: "The CIA triad includes:",
        ar: "يتضمن ثالوث CIA:",
        pts: 3,
        opts: [
          ["Confidentiality", "السرية", true],
          ["Integrity", "السلامة", true],
          ["Availability", "الإتاحة", true],
          ["Anonymity", "إخفاء الهوية", false],
        ],
      },
      {
        t: "short_answer",
        en: "What principle grants users only the access they need?",
        ar: "ما المبدأ الذي يمنح المستخدمين الصلاحيات التي يحتاجونها فقط؟",
        pts: 2,
        accepted: [
          "least privilege",
          "principle of least privilege",
          "الحد الأدنى من الصلاحيات",
          "أقل صلاحية",
        ],
      },
      {
        t: "long_answer",
        en: "An employee reports a suspicious invoice email with a link. Walk through your first 30 minutes of response.",
        ar: "أبلغ موظف عن بريد فاتورة مشبوه يحتوي رابطًا. اشرح أول 30 دقيقة من استجابتك.",
        pts: 10,
        rubric: true,
      },
    ],
  },
  {
    slug: "network-security",
    title_en: "Network Security",
    title_ar: "أمن الشبكات",
    desc_en: "Segmentation, protocols, monitoring and web attack surfaces.",
    desc_ar: "تقسيم الشبكات والبروتوكولات والمراقبة وأسطح هجوم الويب.",
    category: "security",
    difficulty: "intermediate",
    minutes: 35,
    outcomes_en: ["Design segmented networks", "Read traffic for anomalies", "Mitigate OWASP risks"],
    outcomes_ar: ["تصميم شبكات مقسّمة", "قراءة حركة المرور لاكتشاف الشذوذ", "تخفيف مخاطر OWASP"],
    q: [
      {
        t: "multiple_choice",
        en: "Which port does HTTPS use by default?",
        ar: "ما المنفذ الافتراضي لبروتوكول HTTPS؟",
        pts: 2,
        opts: [
          ["443", "443", true],
          ["80", "80", false],
          ["22", "22", false],
          ["3389", "3389", false],
        ],
      },
      {
        t: "multiple_choice",
        en: "Parameterised queries primarily prevent…",
        ar: "الاستعلامات المعلّمة تمنع أساسًا…",
        pts: 2,
        opts: [
          ["SQL injection", "حقن SQL", true],
          ["Clickjacking", "اختطاف النقر", false],
          ["DDoS", "حجب الخدمة الموزع", false],
        ],
      },
      {
        t: "true_false",
        en: "Network segmentation limits lateral movement.",
        ar: "تقسيم الشبكة يحدّ من التحرك الجانبي للمهاجم.",
        pts: 1,
        opts: TF(true),
      },
      {
        t: "multiple_select",
        en: "Signals worth investigating in logs:",
        ar: "مؤشرات تستحق التحقيق في السجلات:",
        pts: 3,
        opts: [
          ["Impossible-travel logins", "تسجيلات دخول بسفر مستحيل", true],
          ["Spikes in failed logins", "ارتفاع حاد في محاولات الدخول الفاشلة", true],
          ["Scheduled nightly backup completing", "اكتمال النسخ الاحتياطي الليلي المجدول", false],
        ],
      },
      {
        t: "case_study",
        en: "Propose a segmentation and monitoring design for a hospital network with clinical devices, staff laptops and guest Wi-Fi.",
        ar: "اقترح تصميمًا للتقسيم والمراقبة لشبكة مستشفى تضم أجهزة سريرية وحواسيب موظفين وشبكة ضيوف.",
        pts: 12,
        rubric: true,
      },
    ],
  },
  {
    slug: "software-engineering",
    title_en: "Software Engineering",
    title_ar: "هندسة البرمجيات",
    desc_en: "Design, testing, version control and delivery practices.",
    desc_ar: "التصميم والاختبار والتحكم بالإصدارات وممارسات التسليم.",
    category: "engineering",
    difficulty: "intermediate",
    minutes: 35,
    outcomes_en: ["Apply design principles", "Write testable code", "Use CI/CD effectively"],
    outcomes_ar: ["تطبيق مبادئ التصميم", "كتابة شيفرة قابلة للاختبار", "استخدام CI/CD بفعالية"],
    q: [
      {
        t: "multiple_choice",
        en: "What does the 'S' in SOLID stand for?",
        ar: "إلامَ يرمز حرف S في SOLID؟",
        pts: 2,
        opts: [
          ["Single responsibility", "المسؤولية الواحدة", true],
          ["Static typing", "الأنواع الساكنة", false],
          ["Scalability", "قابلية التوسع", false],
        ],
      },
      {
        t: "true_false",
        en: "Unit tests should depend on a live production database.",
        ar: "يجب أن تعتمد اختبارات الوحدة على قاعدة بيانات الإنتاج.",
        pts: 1,
        opts: TF(false),
      },
      {
        t: "multiple_select",
        en: "Benefits of continuous integration:",
        ar: "فوائد التكامل المستمر:",
        pts: 3,
        opts: [
          ["Faster feedback on breakages", "تغذية راجعة أسرع عند الأعطال", true],
          ["Smaller, safer merges", "دمج أصغر وأكثر أمانًا", true],
          ["Removes need for code review", "إلغاء الحاجة لمراجعة الشيفرة", false],
        ],
      },
      {
        t: "short_answer",
        en: "Which git command creates a new branch and switches to it (one command, modern syntax)?",
        ar: "ما أمر git الذي ينشئ فرعًا جديدًا وينتقل إليه (أمر واحد بصياغة حديثة)؟",
        pts: 2,
        accepted: ["git switch -c", "git checkout -b"],
      },
      {
        t: "long_answer",
        en: "Design the API and data model for a bilingual job-board 'saved jobs' feature. Cover edge cases and tests.",
        ar: 'صمّم الواجهة البرمجية ونموذج البيانات لميزة "الوظائف المحفوظة" في لوحة وظائف ثنائية اللغة، مع الحالات الحدية والاختبارات.',
        pts: 10,
        rubric: true,
      },
    ],
  },
  {
    slug: "problem-solving",
    title_en: "Problem Solving",
    title_ar: "حل المشكلات",
    desc_en: "Structured reasoning and quantitative estimation.",
    desc_ar: "الاستدلال المنظّم والتقدير الكمي.",
    category: "soft",
    difficulty: "beginner",
    minutes: 20,
    outcomes_en: ["Break problems into parts", "Estimate with stated assumptions", "Prioritise options"],
    outcomes_ar: ["تقسيم المشكلات إلى أجزاء", "التقدير مع افتراضات معلنة", "ترتيب الخيارات حسب الأولوية"],
    q: [
      {
        t: "multiple_choice",
        en: "A task takes 3 people 6 days. At the same rate, how long for 9 people?",
        ar: "مهمة تستغرق 3 أشخاص 6 أيام. بنفس المعدل، كم تستغرق 9 أشخاص؟",
        pts: 2,
        opts: [
          ["2 days", "يومان", true],
          ["3 days", "3 أيام", false],
          ["18 days", "18 يومًا", false],
        ],
      },
      {
        t: "multiple_choice",
        en: "Next in the sequence 2, 6, 12, 20, …",
        ar: "العدد التالي في المتتالية 2، 6، 12، 20، …",
        pts: 2,
        opts: [
          ["30", "30", true],
          ["28", "28", false],
          ["32", "32", false],
        ],
      },
      {
        t: "true_false",
        en: "Defining the problem precisely usually comes before generating solutions.",
        ar: "تحديد المشكلة بدقة يسبق عادةً توليد الحلول.",
        pts: 1,
        opts: TF(true),
      },
      {
        t: "short_answer",
        en: "If 20% of 250 applicants pass screening, how many pass?",
        ar: "إذا اجتاز 20٪ من 250 متقدمًا الفرز، فكم عدد المجتازين؟",
        pts: 2,
        accepted: ["50"],
      },
      {
        t: "case_study",
        en: "Delivery times in Dammam doubled after a warehouse move. Structure how you would find the cause.",
        ar: "تضاعفت أوقات التوصيل في الدمام بعد نقل المستودع. نظّم طريقة بحثك عن السبب.",
        pts: 8,
        rubric: true,
      },
    ],
  },
  {
    slug: "critical-thinking",
    title_en: "Critical Thinking",
    title_ar: "التفكير النقدي",
    desc_en: "Evaluating arguments, evidence and bias.",
    desc_ar: "تقييم الحجج والأدلة والتحيز.",
    category: "soft",
    difficulty: "beginner",
    minutes: 20,
    outcomes_en: ["Spot weak arguments", "Weigh evidence", "Recognise cognitive bias"],
    outcomes_ar: ["اكتشاف الحجج الضعيفة", "موازنة الأدلة", "التعرّف على التحيزات المعرفية"],
    q: [
      {
        t: "multiple_choice",
        en: "'Everyone uses this tool, so it must be best' is an example of…",
        ar: '"الجميع يستخدم هذه الأداة، إذن هي الأفضل" مثال على…',
        pts: 2,
        opts: [
          ["Appeal to popularity", "الاحتكام إلى الشيوع", true],
          ["Valid deduction", "استنتاج صحيح", false],
          ["Straw man", "رجل القش", false],
        ],
      },
      {
        t: "true_false",
        en: "A small, unrepresentative sample can still support strong general conclusions.",
        ar: "عينة صغيرة غير ممثلة يمكنها دعم استنتاجات عامة قوية.",
        pts: 1,
        opts: TF(false),
      },
      {
        t: "multiple_select",
        en: "Which strengthen a claim?",
        ar: "أيّ مما يلي يقوّي الادعاء؟",
        pts: 3,
        opts: [
          ["Independent replication", "التكرار المستقل للنتائج", true],
          ["Transparent method", "منهجية شفافة", true],
          ["Confident tone", "نبرة واثقة", false],
        ],
      },
      {
        t: "short_answer",
        en: "Name the bias of favouring information that confirms existing beliefs.",
        ar: "ما اسم التحيز الذي يفضّل المعلومات المؤكدة للمعتقدات القائمة؟",
        pts: 2,
        accepted: ["confirmation bias", "تحيز التأكيد", "الانحياز التأكيدي"],
      },
      {
        t: "long_answer",
        en: "A vendor claims their AI screening 'removes all bias'. What questions would you ask before believing it?",
        ar: 'يدّعي مورّد أن فرزه بالذكاء الاصطناعي "يزيل كل التحيز". ما الأسئلة التي ستطرحها قبل تصديقه؟',
        pts: 8,
        rubric: true,
      },
    ],
  },
  {
    slug: "communication-skills",
    title_en: "Communication Skills",
    title_ar: "مهارات التواصل",
    desc_en: "Clear writing, audience awareness and feedback.",
    desc_ar: "الكتابة الواضحة ومراعاة الجمهور والتغذية الراجعة.",
    category: "soft",
    difficulty: "beginner",
    minutes: 20,
    outcomes_en: ["Write for the audience", "Give constructive feedback", "Summarise clearly"],
    outcomes_ar: ["الكتابة بما يناسب الجمهور", "تقديم تغذية راجعة بنّاءة", "التلخيص بوضوح"],
    q: [
      {
        t: "multiple_choice",
        en: "Best opening for an executive update email:",
        ar: "أفضل افتتاحية لبريد تحديث للإدارة العليا:",
        pts: 2,
        opts: [
          ["The decision or key outcome first", "القرار أو النتيجة الأساسية أولًا", true],
          ["Full chronological background", "الخلفية الزمنية الكاملة", false],
          ["A list of every task done", "قائمة بكل المهام المنجزة", false],
        ],
      },
      {
        t: "true_false",
        en: "Specific, behaviour-focused feedback is more actionable than general praise.",
        ar: "التغذية الراجعة المحددة المركزة على السلوك أكثر قابلية للتنفيذ من المديح العام.",
        pts: 1,
        opts: TF(true),
      },
      {
        t: "multiple_select",
        en: "Signs of active listening:",
        ar: "علامات الإصغاء الفعّال:",
        pts: 3,
        opts: [
          ["Paraphrasing to confirm", "إعادة الصياغة للتأكيد", true],
          ["Asking clarifying questions", "طرح أسئلة توضيحية", true],
          ["Preparing your reply while they talk", "تحضير ردّك أثناء حديثهم", false],
        ],
      },
      {
        t: "short_answer",
        en: "What does the acronym TL;DR introduce?",
        ar: "ماذا يقدّم الاختصار TL;DR؟",
        pts: 2,
        accepted: ["summary", "a summary", "ملخص", "الملخص"],
      },
      {
        t: "long_answer",
        en: "Rewrite this for a non-technical manager: 'p95 latency regressed 40% post-deploy due to N+1 queries.'",
        ar: 'أعد صياغة ما يلي لمدير غير تقني: "ارتفع زمن الاستجابة p95 بنسبة 40٪ بعد النشر بسبب استعلامات N+1."',
        pts: 8,
        rubric: true,
      },
    ],
  },
  {
    slug: "business-analysis",
    title_en: "Business Analysis",
    title_ar: "تحليل الأعمال",
    desc_en: "Requirements, process modelling and acceptance criteria.",
    desc_ar: "المتطلبات ونمذجة العمليات ومعايير القبول.",
    category: "business",
    difficulty: "intermediate",
    minutes: 30,
    outcomes_en: ["Elicit and document requirements", "Model processes", "Write acceptance criteria"],
    outcomes_ar: ["استخلاص المتطلبات وتوثيقها", "نمذجة العمليات", "كتابة معايير القبول"],
    q: [
      {
        t: "multiple_choice",
        en: "A non-functional requirement describes…",
        ar: "المتطلب غير الوظيفي يصف…",
        pts: 2,
        opts: [
          ["Quality attributes like performance", "خصائص الجودة مثل الأداء", true],
          ["A specific user action", "إجراءً محددًا للمستخدم", false],
          ["A database table", "جدول قاعدة بيانات", false],
        ],
      },
      {
        t: "true_false",
        en: "BPMN is a notation for modelling business processes.",
        ar: "BPMN ترميز لنمذجة عمليات الأعمال.",
        pts: 1,
        opts: TF(true),
      },
      {
        t: "multiple_select",
        en: "Good user story qualities (INVEST):",
        ar: "صفات قصة المستخدم الجيدة (INVEST):",
        pts: 3,
        opts: [
          ["Independent", "مستقلة", true],
          ["Testable", "قابلة للاختبار", true],
          ["Vague", "مبهمة", false],
        ],
      },
      {
        t: "short_answer",
        en: "Complete the user-story template: 'As a ___, I want ___, so that ___.' What goes in the first blank?",
        ar: 'أكمل قالب قصة المستخدم: "بصفتي ___، أريد ___، لكي ___." ماذا يوضع في الفراغ الأول؟',
        pts: 2,
        accepted: ["user", "role", "user role", "دور", "المستخدم", "دور المستخدم"],
      },
      {
        t: "case_study",
        en: "A hospital wants online appointment rescheduling. Write three user stories with acceptance criteria and one key risk.",
        ar: "يريد مستشفى إعادة جدولة المواعيد إلكترونيًا. اكتب ثلاث قصص مستخدم مع معايير القبول وخطرًا رئيسيًا واحدًا.",
        pts: 10,
        rubric: true,
      },
    ],
  },
  {
    slug: "project-management",
    title_en: "Project Management",
    title_ar: "إدارة المشاريع",
    desc_en: "Planning, risk, agile delivery and stakeholder reporting.",
    desc_ar: "التخطيط والمخاطر والتسليم الرشيق وتقارير أصحاب المصلحة.",
    category: "business",
    difficulty: "intermediate",
    minutes: 30,
    outcomes_en: ["Plan scope and schedule", "Manage risk", "Run agile ceremonies effectively"],
    outcomes_ar: ["تخطيط النطاق والجدول", "إدارة المخاطر", "إدارة اجتماعات الأجايل بفعالية"],
    q: [
      {
        t: "multiple_choice",
        en: "The critical path is…",
        ar: "المسار الحرج هو…",
        pts: 2,
        opts: [
          ["The longest chain of dependent tasks", "أطول سلسلة من المهام المعتمدة", true],
          ["The most expensive task", "المهمة الأعلى تكلفة", false],
          ["The first milestone", "المرحلة الأولى", false],
        ],
      },
      {
        t: "true_false",
        en: "In Scrum, the Product Owner orders the product backlog.",
        ar: "في سكرم، يرتّب مالك المنتج قائمة أعمال المنتج.",
        pts: 1,
        opts: TF(true),
      },
      {
        t: "multiple_select",
        en: "Valid risk responses:",
        ar: "استجابات صحيحة للمخاطر:",
        pts: 3,
        opts: [
          ["Mitigate", "التخفيف", true],
          ["Transfer", "النقل", true],
          ["Accept", "القبول", true],
          ["Ignore without logging", "التجاهل دون تسجيل", false],
        ],
      },
      {
        t: "short_answer",
        en: "What is the time-boxed iteration in Scrum called?",
        ar: "ما اسم التكرار محدد الوقت في سكرم؟",
        pts: 2,
        accepted: ["sprint", "سبرنت", "العدو"],
      },
      {
        t: "case_study",
        en: "Your ERP rollout is three weeks late with a fixed go-live. Present options to the steering committee.",
        ar: "مشروع تطبيق نظام تخطيط الموارد متأخر ثلاثة أسابيع وموعد الإطلاق ثابت. قدّم الخيارات للجنة التوجيهية.",
        pts: 10,
        rubric: true,
      },
    ],
  },
];
