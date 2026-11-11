-- JADARAH — 0022 opportunity provenance + sector skills for the initial organizations.
-- A job is either a VERIFIED vacancy (source + check date required) or a SIMULATION (clearly labelled,
-- never presented as an official vacancy). Additive taxonomy rows only (on conflict do nothing).

alter table public.jobs
  add column if not exists listing_type text not null default 'simulation' check (listing_type in ('verified', 'simulation')),
  add column if not exists source_url text,
  add column if not exists source_checked_on date;
alter table public.jobs add constraint jobs_verified_requires_source
  check (listing_type <> 'verified' or (source_url is not null and source_checked_on is not null));

insert into public.skill_categories (slug, name_en, name_ar) values
  ('finance', 'Finance & Accounting', 'المالية والمحاسبة'),
  ('regulation', 'Regulation & Compliance', 'التنظيم والامتثال'),
  ('industrial', 'Industrial & Quality Engineering', 'الهندسة الصناعية والجودة'),
  ('construction', 'Construction & Projects', 'التشييد والمشاريع'),
  ('events', 'Events, Tourism & Hospitality', 'الفعاليات والسياحة والضيافة')
on conflict (slug) do nothing;

insert into public.skills (slug, name_en, name_ar, kind, aliases, category_id)
select v.slug, v.name_en, v.name_ar, 'technical', v.aliases, c.id
from (values
  ('financial-modeling', 'Financial Modeling', 'النمذجة المالية', array['financial model', 'valuation model'], 'finance'),
  ('budgeting-forecasting', 'Budgeting & Forecasting', 'إعداد الموازنات والتنبؤ', array['budgeting', 'forecasting'], 'finance'),
  ('financial-analysis', 'Financial Analysis', 'التحليل المالي', array['financial statements analysis', 'ratio analysis'], 'finance'),
  ('credit-analysis', 'Credit Analysis', 'التحليل الائتماني', array['credit assessment', 'credit risk'], 'finance'),
  ('ifrs-accounting', 'IFRS Accounting', 'المحاسبة وفق المعايير الدولية', array['ifrs', 'accounting'], 'finance'),
  ('risk-assessment', 'Risk Assessment', 'تقييم المخاطر', array['risk management', 'risk analysis'], 'regulation'),
  ('regulatory-compliance', 'Regulatory Compliance', 'الامتثال التنظيمي', array['compliance', 'regulations'], 'regulation'),
  ('policy-analysis', 'Policy Analysis', 'تحليل السياسات', array['policy review'], 'regulation'),
  ('consumer-protection', 'Consumer Protection', 'حماية المستهلك', array['consumer rights'], 'regulation'),
  ('quality-control', 'Statistical Quality Control', 'ضبط الجودة الإحصائي', array['spc', 'quality control'], 'industrial'),
  ('root-cause-analysis', 'Root Cause Analysis', 'تحليل السبب الجذري', array['rca', '5 whys', 'fishbone'], 'industrial'),
  ('lean-six-sigma', 'Lean Six Sigma', 'لين ستة سيجما', array['six sigma', 'lean'], 'industrial'),
  ('iso-9001', 'ISO 9001 Quality Management', 'إدارة الجودة ISO 9001', array['iso 9001', 'qms'], 'industrial'),
  ('maintenance-planning', 'Maintenance Planning', 'تخطيط الصيانة', array['preventive maintenance', 'cmms'], 'industrial'),
  ('process-safety', 'Process Safety', 'سلامة العمليات', array['hse', 'hazop'], 'industrial'),
  ('project-scheduling', 'Project Scheduling', 'جدولة المشاريع', array['primavera', 'critical path', 'cpm'], 'construction'),
  ('construction-management', 'Construction Management', 'إدارة التشييد', array['site management'], 'construction'),
  ('cost-estimation', 'Cost Estimation', 'تقدير التكاليف', array['quantity surveying', 'boq'], 'construction'),
  ('event-planning', 'Event Planning', 'تخطيط الفعاليات', array['event management'], 'events'),
  ('event-risk-management', 'Event Risk & Crowd Safety', 'إدارة مخاطر الفعاليات وسلامة الحشود', array['crowd management'], 'events'),
  ('vendor-management', 'Vendor Management', 'إدارة الموردين', array['supplier management', 'procurement'], 'events'),
  ('customer-experience', 'Customer Experience', 'تجربة العملاء', array['cx', 'guest experience'], 'events')
) as v(slug, name_en, name_ar, aliases, cat)
join public.skill_categories c on c.slug = v.cat
on conflict (slug) do nothing;

insert into public.job_categories (slug, name_en, name_ar) values
  ('finance', 'Finance & Accounting', 'المالية والمحاسبة'),
  ('engineering', 'Engineering & Industry', 'الهندسة والصناعة'),
  ('events', 'Events, Tourism & Hospitality', 'الفعاليات والسياحة والضيافة'),
  ('public-sector', 'Regulation & Public Sector', 'التنظيم والقطاع العام')
on conflict (slug) do nothing;
