# Question-level task evaluation

Every question is graded against its own instructions and criteria, using only the answer and files submitted for that
question. The task score is calculated from the individual question results. Introduced by migration
`20261112000033_question_level_evaluation.sql`; applied to the hosted project on 2026-11-12. In the ledger, the Supabase
MCP connection recorded it as `20261112072336 question_level_evaluation`.

## Root causes (before)

1. **Files had no question.** Only `file_upload` questions accepted files. Practical tasks are stored as `coding`,
   `case_study`, `sql` and `long_answer` questions, so their files went into one submission-level "Task Solution Files"
   area (`question_id = null`).
2. **One rubric for every question.** The task builder attached the assessment-wide rubric to every task. In
   production, 31 of 37 AI-built questions shared a rubric, so each question was shown, and scored against, the other
   questions' criteria.
3. **The AI never read files.** The rubric assistant sent only the typed answer, refused questions without a rubric,
   and stored nothing next to the human score.
4. **Double counting.** The total added every human evaluation to the automatic score, so a reviewed objective
   question was counted twice.

## Relationships

```
assessments ─< assessment_questions (id, position, points = weight, config.deliverables, rubric_id)
                 │        └─ assessment_rubrics (criteria; question_id = the question it belongs to)
assessment_assignments (task → candidate, application, company)
  └─ assessment_submissions (one per assignment)
       ├─< assessment_answers            (submission_id, question_id)  unique per question
       ├─< assessment_answer_files       (submission_id, question_id, storage_path, mime, size)
       ├─< assessment_ai_evaluations     (submission_id, question_id)  append-only AI results
       ├─< assessment_evaluations        (submission_id, question_id)  human-approved score + feedback
       └─< assessment_evaluation_history (submission_id, question_id)  every change, with timestamps
```

## How a file is mapped to its question

- The candidate uploads inside the question's own area, so the storage path is
  `<candidate>/<submission>/<question>/<file>`.
- The storage policy (`can_write_storage_object`) only accepts that path for the caller's own in-progress submission
  and an open question of that task.
- `register_assessment_file` checks the path against the question id it is given and stores `question_id`.
- Evaluation selects files with `submission_id = S AND question_id = Q`. File names, upload order and positions are
  never used.
- Files uploaded before this change (`question_id null`) are listed separately as "not linked to a question" and are
  never evaluated as an answer.

## How one question is evaluated (`evaluateQuestionWithAI`)

1. Load the question: instructions, deliverables and points.
2. Choose the criteria:
   - the question's own employer rubric;
   - otherwise, an assessment-wide rubric narrowed to this task's criteria using the builder's criterion → task mapping
     (read-only, so it also works for tasks locked after assignment);
   - otherwise, the assessment-wide rubric, labelled as such, where the model marks criteria that do not apply;
   - otherwise, AI-derived criteria that add up to the question's points, labelled "AI-suggested, needs approval".
3. Load only this question's answer and files, download them, and read their actual contents. The declared type is
   checked against the file's bytes:
   - PDF: text layer. Scanned PDFs get an AI transcription, labelled as such.
   - DOCX: text.
   - PPTX: slide text in slide order plus speaker notes (images and charts are not read).
   - XLSX: cell values by address per named sheet (`A2=Marketing | B2=12000 | D2=27500 (=B2+C2)`), shared strings
     and formulas resolved. A presentation or workbook with no real text is reported as unread, never as "read".
   - DOC (Word 97–2003): text through `word-extractor`.
   - Password-protected PDF / Office files: reported as password-protected.
   - ZIP: read in memory (`src/lib/zip/safe-zip.ts`). Unsafe names, symlinks, encrypted entries and ZIP bombs are
     refused, and the full archive listing is kept.
   - PNG / JPEG / WEBP: AI transcription and description.
   - Legacy `.xls`: reported as unsupported, never "evaluated".
4. If nothing was submitted, the result is `no_submission` (suggested 0, to be confirmed). If no file could be read and
   there is no text, the result is `extraction_failed` with no score. Neither is ever counted as a successful answer.
5. The model returns, per criterion: score, an exact quote, the rationale, and whether the requirement is fulfilled,
   partial or missing. It also returns strengths, issues and improvements.
6. Quotes are checked against this question's submitted text. Scores without a quote are flagged for the reviewer.
   Scores are clamped and scaled to the question's points.
7. The result is stored in `assessment_ai_evaluations` (recruiters of the company only; candidates never see it). It
   never changes the score.

## Reliability, transparency and rejection (added after the handover snapshot b57ebca)

- **Duplicate prevention.** Before any file is read by AI, the action hashes the complete input: every file's bytes,
  the written answer, the task and question ids, the instructions, points, deliverables, the criteria and their source,
  the output language and the evaluator version (`src/lib/domain/evaluation-hash.ts`). When the latest stored result
  has the same hash (and is a real result that was not rejected), it is returned and **no AI call is made**. The
  reviewer is told nothing changed and can confirm "Re-evaluate anyway" (`force`), which runs a new evaluation. An
  "unreadable files" result is never reused.
- **One run at a time** per submission + question: an in-process lock (`src/services/evaluation/run-lock.ts`), plus a
  database lock when proposal 0034 is applied.
- **States per question** (`questionEvaluationState`): Not evaluated, Reading files, Evaluating, Completed, Failed,
  Requires human review. A stored AI result is a suggestion: the question "requires human review" until a reviewer
  decides. With proposal 0034, runs are persisted (`assessment_ai_runs`): the panel polls
  `/api/company/evaluation-state` during a run, and a failure stays visible after a refresh with its message. A run that
  stops reporting for 5 minutes is closed as failed. Without 0034 the states come from stored results and reviews only.
- **Prompt identifiers.** The evaluation prompt starts with `TASK ID` and `QUESTION ID`.
- **Model-stated limitations.** The model returns `limitations[]` (content it could not see, code it could not run,
  ambiguous instructions). Stored in their own column with 0034; without it they are kept as "points to check".
- **Confidence** (`evaluationConfidence`): high / medium / low with reasons, derived only from recorded facts:
  - low: a file could not be read; more than half of the positive scores have no quote found in the submission;
  - medium: AI transcription (OCR or image), partially read archive, truncation, some unverified quotes, AI-derived or
    assessment-wide criteria, limitations stated by the model;
  - high: every file read and every positive score backed by a verified quote.
- **Explicit rejection** (proposal 0034, `reject_ai_question_evaluation`): the reviewer rejects one AI result with a
  reason. The AI result is kept unchanged; the rejection is stored in `assessment_ai_rejections` and written to the
  review history ("AI suggestion rejected: <reason>"). A rejected result cannot be accepted. A score given afterwards is
  recorded with source `ai_rejected` and the rejected result's id; an approved score that was based on that result
  keeps its points but its source becomes `ai_rejected`.
- **Offline live check**: `scripts/verify/evaluate-fixtures.ts` runs the same extraction and evaluator on the real
  fixtures with the configured provider and writes nothing to any database.

## Human review and scores

- `review_assessment_question` stores the reviewer's score, rubric scores, private notes and candidate feedback
  ("what was done well", "what was missing", "how to improve").
- It records `source`:
  - `human`: no AI suggestion was used;
  - `ai_accepted`: the reviewer kept the AI score;
  - `ai_adjusted`: the reviewer changed the AI score;
  - `ai_rejected` (proposal 0034): the reviewer explicitly rejected the AI suggestion and scored independently.
- The AI result itself is never altered.
- Every change is written to `assessment_evaluation_history`.
- `_recompute_submission_score` (mirrored in `aggregateQuestionScores` in `src/lib/domain/scoring.ts`):
  - a reviewed question counts its approved score;
  - otherwise an objective question counts its automatic score;
  - otherwise the question is pending (never counted as 0 or as correct);
  - total = Σ question scores; maximum = Σ question points (the points are the weights);
  - the percentage is shown only when nothing is pending.
- Nothing rejects a candidate automatically.

## Candidate report

`get_assessment_result` returns, per question: the approved score, the review state (automatic, reviewed, awaiting
review) and the files submitted for that question. Per-question written feedback is returned only after the company
shares feedback (the existing publication rule). Reviewer notes, AI results and model details are never returned to
the candidate.

## Tests

- **Unit** (`tests/unit/question-evaluation.test.ts`): ZIP safety (traversal, symlinks, encryption, bombs, limits);
  real PDF, DOCX and ZIP extraction; a fake PDF fails; a damaged `.doc` is reported as failed; criteria precedence and task
  mapping; evidence checks; score clamping and scaling; input isolation; overall score aggregation.
- **SQL** (`tests/db/0033_question_level_evaluation.test.sql`, run as real roles): files by question; objective
  questions refuse files; a path cannot be registered against another question; the rubric split, including that
  in-use tasks are skipped; AI evaluations visible to recruiters only; a review cannot use another question's AI
  result; `ai_accepted` / `ai_adjusted` / `human`; history; no double counting; weighted totals; candidate visibility
  before and after sharing; another company and anonymous users denied.
- **Live end-to-end** (`scripts/verify/question-evaluation-e2e.cjs`; production, demo accounts, real AI): a 5-question
  task with a PDF, a ZIP, and a DOCX plus a PNG on separate questions, one question unanswered and one objective. All
  29 checks passed.

## Known limitations

- Code is read, not executed: there is no sandbox. The evaluator is told so and must not claim code runs.
- Scanned PDFs and images depend on AI transcription (Gemini). If it is unavailable, the file is reported as unread.
- Text limits per evaluation: 10,000 characters of answer, 14,000 per file and 45,000 across files. Truncation is
  reported.
- ZIP limits: no ZIP64; at most 500 entries, 60 files read, 2 MB per entry and 12 MB in total. Nested archives and
  images inside archives are listed, not read.
- AI results are recorded through an RPC that recruiters of the company may call. A recruiter could store a fabricated
  "AI" record for their own candidates. Every record is in the audit log, and a server-only key would close this.
- Two AI-built tasks already given to candidates keep their shared rubric rows (locked by 0025). The task mapping is
  applied read-only when they are evaluated, but their candidates still see the full criteria list.
- Model scores vary between runs. Quotes are verified, and a person approves every score.
