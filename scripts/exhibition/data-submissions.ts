/** Candidate submissions (fictional work) at different quality levels. Each answer belongs to exactly one question. */
import type { Cell, Sheet } from "./office";

export type Quality = "excellent" | "good" | "average" | "partial" | "weak";
export type Submission = {
  job: string;
  candidate: string; // email
  quality: Quality;
  mcq: number; // selected option index (0 = correct option in the data)
  q2: string;
  q3: { kind: "docx"; lines: string[] } | { kind: "xlsx"; sheets: Sheet[] } | null;
  q4: string;
};

const v = (f: string, val: number | string): Cell => ({ f, v: val });

export const SUBMISSIONS: Submission[] = [
  // ---------------------------------------------------------------- MoC Legal
  {
    job: "moc-legal",
    candidate: "noura.alotaibi@jadarah.example",
    quality: "excellent",
    mcq: 0,
    q2:
      "Timeline: paid 1 Oct; promised delivery by 11 Oct; the 15-day maximum ended 16 Oct; still undelivered on 26 Oct (25 days).\n1) Art. 3 — late delivery: both the store's own 10-day promise and the 15-day cap were exceeded.\n2) Art. 4 — refusal to refund: after the late delivery the consumer cancelled, so the store owes the full 2,400 SAR, by the original payment method, within 7 days of the cancellation request. The voucher does not settle this because the consumer did not accept it.\n3) Art. 6 — misleading advert: 'free delivery within 3 days' contradicts the 10-day promise and the actual 25-day delay.\n4) Art. 9 — no commercial registration number on the store page.\nRemedy: cancellation and full refund within 7 days. The authority can warn, order the refund and fine the store (Art. 12).",
    q3: {
      kind: "docx",
      lines: [
        "Legal memo — Rawabi Home complaint",
        "To: Director of Consumer Protection",
        "Facts: payment of 2,400 SAR on 1 October; promised delivery in 10 days; advert promised free delivery in 3 days; not delivered by 26 October; refund refused, voucher offered; no CR number displayed.",
        "Issues: late delivery (Art. 3); refund duty and voucher (Art. 4); misleading advert (Art. 6); store disclosures (Art. 9).",
        "Analysis: The delivery is 15 days late against the store's promise and beyond the 15-day legal cap, breaching Art. 3. Because delivery was late, the consumer validly cancelled; Art. 4 requires a full refund in the original payment method within 7 days and a voucher is only acceptable with the consumer's consent, which was not given. The 3-day advert misled consumers about delivery time (Art. 6). The missing commercial registration number breaches Art. 9.",
        "Recommended actions: order the 2,400 SAR refund within 7 days; written warning covering Arts. 3, 6 and 9; fine if the misleading advert is still live after the warning (Art. 12); require the CR number on the store within 5 working days.",
        "Evidence to request: bank/card transaction record; order confirmation with the 10-day promise; archived copy of the advert; courier/delivery log; the consumer's cancellation message and the store's reply; screenshot of the store page.",
      ],
    },
    q4: "Rawabi Home: under Art. 4 you are required to refund the consumer's 2,400 SAR in full, using the original payment method, within 7 days of the cancellation request; the voucher you offered does not replace the refund. If the refund is not made within this period, the case will be referred for action under Art. 12.",
  },
  {
    job: "moc-legal",
    candidate: "haya.aldosari@jadarah.example",
    quality: "partial",
    mcq: 1,
    q2: "The store delivered late which is against Article 3. The consumer should get his money back or accept the voucher because the voucher has the same value. The advert about 3 days may be misleading.",
    q3: {
      kind: "docx",
      lines: ["Memo", "The store was late in delivering the dining set. This is a violation.", "We recommend sending a warning to the store."],
    },
    q4: "",
  },
  // ---------------------------------------------------------------- GEA PR
  {
    job: "gea-pr",
    candidate: "sarah.alharbi@jadarah.example",
    quality: "good",
    mcq: 0,
    q2:
      "Holding statement: \"We're sorry to everyone who waited at the Winter Lights gates tonight. A network fault stopped ticket scanning for around 40 minutes. It has now been fixed and entry is back to normal. No one was injured. Guests who were affected will receive a free re-entry pass — details will follow on our official accounts tomorrow.\"\nKey messages: 1) We apologise and value our visitors' time. 2) The fault is fixed and safety was not affected. 3) Affected guests will get a free re-entry pass.",
    q3: {
      kind: "docx",
      lines: [
        "Winter Lights — communication plan (7 days)",
        "Audiences: affected ticket holders (SMS/email), public (social media, website), media (press statement), sponsors (direct call).",
        "Day 0: holding statement within the hour, pinned post. Day 1: send re-entry passes by SMS; press note. Day 2–3: explainer video about the fix. Day 4–6: share positive visitor content. Day 7: wrap-up post.",
        "Spokesperson: Communications Director.",
        "KPIs: reduce negative sentiment from 62% to under 35% within a week; reply to social media complaints within 3 hours.",
      ],
    },
    q4: "1) Test the scanners with a backup offline mode before opening — KPI: no more than 1% failed scans. 2) Open gates earlier and split entry times — KPI: average waiting time under 15 minutes.",
  },
  {
    job: "gea-pr",
    candidate: "khalid.alanazi@jadarah.example",
    quality: "weak",
    mcq: 2,
    q2: "We will post that there was a technical problem from the supplier and it is not our fault. Everything is fine now.",
    q3: { kind: "docx", lines: ["Plan", "Post on social media every day.", "Talk to the media."] },
    q4: "Better technology next time.",
  },
  // ---------------------------------------------------------------- Elm TA
  {
    job: "elm-ta",
    candidate: "joud.alshammari@jadarah.example",
    quality: "excellent",
    mcq: 0,
    q2:
      "Backend Developer: conversions 28.6% → 50% → 30% → 27.8% → 60%. The weak point is assessed → interviewed (18 of 60, 30%), together with 41 days to hire; the assessment may be too strict or interviews are booked slowly.\nData Analyst: 30.6% → 54.7% → 38.5% → 30% → 83.3%, 33 days. A healthy funnel; screening at 30.6% is the only notable drop and is expected for a high-volume role.\nProduct Designer: 26.7% → 55% → 40.9% → 33.3% → 33.3%, 55 days. The weakest stage is offer acceptance (1 of 3) and the process is the slowest; candidates likely accept other offers before ours arrives or the package is below market.",
    q3: {
      kind: "xlsx",
      sheets: [
        {
          name: "Data",
          rows: [
            ["Role", "Applicants", "Screened", "Assessed", "Interviewed", "Offers", "Accepted", "Days", "Screen %", "Assess %", "Interview %", "Offer %", "Acceptance %", "Hire rate %"],
            ["Backend Developer", 420, 120, 60, 18, 5, 3, 41, v("C2/B2*100", 28.57), v("D2/C2*100", 50), v("E2/D2*100", 30), v("F2/E2*100", 27.78), v("G2/F2*100", 60), v("G2/B2*100", 0.71)],
            ["Data Analyst", 310, 95, 52, 20, 6, 5, 33, v("C3/B3*100", 30.65), v("D3/C3*100", 54.74), v("E3/D3*100", 38.46), v("F3/E3*100", 30), v("G3/F3*100", 83.33), v("G3/B3*100", 1.61)],
            ["Product Designer", 150, 40, 22, 9, 3, 1, 55, v("C4/B4*100", 26.67), v("D4/C4*100", 55), v("E4/D4*100", 40.91), v("F4/E4*100", 33.33), v("G4/F4*100", 33.33), v("G4/B4*100", 0.67)],
          ],
        },
        {
          name: "Recommendations",
          rows: [
            ["Recommendation", "Based on"],
            ["Review Product Designer offers against the market and send offers within 3 days of the final interview", "Acceptance 33.3%, 55 days to hire"],
            ["Recalibrate the Backend assessment pass mark with the hiring manager and schedule interviews within a week", "Only 30% of assessed reach interview; 41 days"],
            ["Use the Data Analyst process (33 days, 83.3% acceptance) as the standard timeline", "Best performing funnel"],
          ],
        },
      ],
    },
    q4: "Week 1: laptop, data warehouse and BI access; assign a buddy from the analytics team.\nWeek 2: shadow the weekly KPI dashboard and the hiring report; read the data dictionary.\nWeek 3: build a first small report for a hiring manager with the buddy's review.\nDay 30: check-in with the manager against three agreed goals and set the 90-day plan.",
  },
  {
    job: "elm-ta",
    candidate: "sarah.alharbi@jadarah.example",
    quality: "average",
    mcq: 1,
    q2: "Product Designer has the lowest acceptance, only 1 person accepted out of 3 offers, and it takes 55 days. Backend has the most applicants (420) so it is doing well. Data Analyst looks good with 5 hires.",
    q3: {
      kind: "xlsx",
      sheets: [
        {
          name: "Funnel",
          rows: [
            ["Role", "Applicants", "Accepted", "Hire rate %", "Acceptance %"],
            ["Backend Developer", 420, 3, v("C2/B2*100", 0.71), 60],
            ["Data Analyst", 310, 5, v("C3/B3*100", 1.61), 83],
            ["Product Designer", 150, 1, v("C4/B4*100", 0.67), 33],
          ],
        },
      ],
    },
    q4: "Give the new analyst a welcome meeting, then training, then let them start working on reports.",
  },
  // ---------------------------------------------------------------- DGDA Procurement
  {
    job: "dgda-procurement",
    candidate: "lujain.alomari@jadarah.example",
    quality: "good",
    mcq: 0,
    q2: "Bidder B is out: its technical score (74) is below the 75 minimum. For A and C the lowest qualified price is A's 1,150,000 SAR. A: price score 100, total 0.6×82 + 0.4×100 = 89.2. C: price score 1,150,000 ÷ 1,320,000 × 100 = 87.1, total 54 + 34.8 = 88.8. I recommend awarding to Bidder A. The two scores are close so the committee should keep the technical evaluation notes on file.",
    q3: {
      kind: "xlsx",
      sheets: [
        {
          name: "Bids",
          rows: [
            ["Bidder", "Technical", "Price", "Qualified", "Price score", "Total", "Rank"],
            ["A", 82, 1150000, v('IF(B2>=75,"Yes","No")', "Yes"), v("1150000/C2*100", 100), v("0.6*B2+0.4*E2", 89.2), 1],
            ["B", 74, 980000, v('IF(B3>=75,"Yes","No")', "No"), "-", "-", "Excluded"],
            ["C", 90, 1320000, v('IF(B4>=75,"Yes","No")', "Yes"), v("1150000/C4*100", 87.12), v("0.6*B4+0.4*E4", 88.85), 2],
            [],
            ["Recommendation: award to Bidder A"],
          ],
        },
      ],
    },
    q4: "1) Delays because of heritage approvals — add a schedule with milestones and delay penalties. 2) Poor quality signage — require samples to be approved before production and a warranty period.",
  },
  {
    job: "dgda-procurement",
    candidate: "abdulaziz.alqahtani@jadarah.example",
    quality: "average",
    mcq: 0,
    q2: "Using the lowest price 980,000 (Bidder B): A price score 85.2 → total 83.3; B price score 100 → total 84.4; C price score 74.2 → total 83.7. Bidder B has the highest total so it should win, although its technical score is the lowest.",
    q3: {
      kind: "xlsx",
      sheets: [
        {
          name: "Evaluation",
          rows: [
            ["Bidder", "Technical", "Price", "Price score", "Total"],
            ["A", 82, 1150000, v("980000/C2*100", 85.22), v("0.6*B2+0.4*D2", 83.29)],
            ["B", 74, 980000, v("980000/C3*100", 100), v("0.6*B3+0.4*D3", 84.4)],
            ["C", 90, 1320000, v("980000/C4*100", 74.24), v("0.6*B4+0.4*D4", 83.7)],
            ["Winner", "B"],
          ],
        },
      ],
    },
    q4: "Risk of late delivery — penalty clause.",
  },
  // ---------------------------------------------------------------- stc CX
  {
    job: "stc-cx",
    candidate: "khalid.alanazi@jadarah.example",
    quality: "good",
    mcq: 0,
    q2: "First: Billing — 1,240 complaints (37% of 3,350), CSAT 2.9 and 52 hours to resolve, so it affects the most customers. Second: Network coverage — 860 complaints (25.7%), the lowest CSAT (2.4) and the slowest resolution (96 hours). Together they are about 63% of all complaints. App login has many complaints too (20.6%) but is solved in 20 hours.",
    q3: {
      kind: "xlsx",
      sheets: [
        {
          name: "Pareto",
          rows: [
            ["Category", "Complaints", "Share %", "Cumulative %", "Priority (share x (5-CSAT))"],
            ["Billing", 1240, v("B2/3350*100", 37.01), v("C2", 37.01), v("C2*(5-2.9)", 77.73)],
            ["Network coverage", 860, v("B3/3350*100", 25.67), v("D2+C3", 62.69), v("C3*(5-2.4)", 66.75)],
            ["App login", 690, v("B4/3350*100", 20.6), v("D3+C4", 83.28), v("C4*(5-3.1)", 39.13)],
            ["Device delivery", 410, v("B5/3350*100", 12.24), v("D4+C5", 95.52), v("C5*(5-3.6)", 17.13)],
            ["Roaming", 150, v("B6/3350*100", 4.48), v("D5+C6", 100), v("C6*(5-2.7)", 10.3)],
          ],
        },
      ],
    },
    q4: "1) Clearer bill with a short explanation of each charge — billing complaints down 20% in 3 months. 2) Faster network complaint handling with a technician callback — resolution under 48 hours. 3) Fix the app login with OTP — login complaints down 40%.",
  },
  {
    job: "stc-cx",
    candidate: "joud.alshammari@jadarah.example",
    quality: "partial",
    mcq: 2,
    q2: "Billing because it has the most complaints, and Roaming because it has a low CSAT.",
    q3: {
      kind: "xlsx",
      sheets: [
        {
          name: "Sheet1",
          rows: [
            ["Category", "Complaints", "Share"],
            ["Billing", 1240, 37],
            ["Network coverage", 860, 26],
            ["App login", 690, 21],
          ],
        },
      ],
    },
    q4: "",
  },
  // ---------------------------------------------------------------- SDAIA Strategy
  {
    job: "sdaia-strategy",
    candidate: "haya.aldosari@jadarah.example",
    quality: "excellent",
    mcq: 0,
    q2: "Onboarding is at 40% of the year-1 target (24 of 60), but the bigger gap is activation: only 9 of the 24 onboarded entities use the platform monthly (37.5%), which is just 15% of the target. Joining is not the same as using. Among non-active entities the dominant barriers are data readiness (58%) and skills (46%) — both capability gaps inside entities. Procurement (31%) and trust/privacy (27%) are smaller but are hard blockers for the entities that cite them, so they need a standard solution rather than case-by-case handling.",
    q3: {
      kind: "docx",
      lines: [
        "Strategy brief: moving from onboarding to active use",
        "Diagnosis — 24/60 onboarded (40%); 9/24 active monthly (37.5%); 15% of target active. Barriers: data readiness 58%, skills 46%, procurement 31%, trust and privacy 27%.",
        "Initiative 1 — Data readiness sprints: a 6-week package (data inventory, quality checks, use-case template). KR: entities passing readiness review 9 → 30 by end of Q4.",
        "Initiative 2 — Entity champions and training: one trained champion per entity plus role-based courses. KR: trained champions 0 → 60 by Q3; monthly active entities 9 → 30 by Q4.",
        "Initiative 3 — Ready-to-use procurement and privacy pack: framework agreement, data protection impact template, security assurance summary. KR: median days from onboarding to first use 90 → 30.",
        "Roadmap — Q1: assess all 60 entities and appoint champions. Q2: first readiness wave (15 entities); framework agreement signed. Q3: second wave (15); training complete. Q4: OKR review; year-2 targets.",
        "Governance — monthly adoption scorecard to the steering committee.",
      ],
    },
    q4: "1) Entity leaders and Chief Data Officers — quarterly steering meeting with each entity's adoption scorecard. 2) Data and IT teams — monthly readiness clinics and shared templates. 3) Procurement and legal departments — a pre-approved framework contract and a privacy guidance session.",
  },
  {
    job: "sdaia-strategy",
    candidate: "noura.alotaibi@jadarah.example",
    quality: "average",
    mcq: 0,
    q2: "Only 24 entities out of 60 joined, which is 40%. The main barrier is data readiness at 58%, then skills at 46%. We should focus on helping entities prepare their data and train their staff.",
    q3: {
      kind: "docx",
      lines: [
        "Strategy brief",
        "Problem: adoption is 40% of the target.",
        "Initiatives: 1) data preparation support, 2) training programmes, 3) awareness campaign.",
        "Goal: reach 60 entities by the end of the year.",
      ],
    },
    q4: "Government entities, the IT department and the platform team. We will communicate with them through meetings and emails.",
  },
  // ---------------------------------------------------------------- Sipchem Supply chain
  {
    job: "sipchem-supply",
    candidate: "abdulaziz.alqahtani@jadarah.example",
    quality: "excellent",
    mcq: 0,
    q2: "ROPs: Catalyst X 12×20+60 = 300; Valve kit 3×30+30 = 120; Pump seal 5×15+25 = 100; Filter 20×7+40 = 180.\nCatalyst X: 250 < 300 → order now; cover 20.8 days ≈ lead time 20, so place it today.\nValve kit: 80 < 120 → order and expedite. Cover is only 26.7 days while lead time is 30 days, so a normal order arrives after the stock runs out — a stockout of about 3 days is likely unless we expedite or find stock elsewhere.\nPump seal: 140 > 100 → no order (28 days of cover).\nFilter cartridge: 150 < 180 → order now; cover 7.5 days vs 7-day lead time.",
    q3: {
      kind: "xlsx",
      sheets: [
        {
          name: "Reorder",
          rows: [
            ["Item", "Daily use", "Lead time", "Safety stock", "On hand", "ROP", "Cover (days)", "Reorder", "Urgency", "Order qty"],
            ["Catalyst X", 12, 20, 60, 250, v("B2*C2+D2", 300), v("E2/B2", 20.83), v('IF(E2<F2,"Yes","No")', "Yes"), v('IF(G2<C2,"Expedite","Normal")', "Normal"), v('IF(H2="Yes",F2+B2*C2-E2,0)', 290)],
            ["Valve kit", 3, 30, 30, 80, v("B3*C3+D3", 120), v("E3/B3", 26.67), v('IF(E3<F3,"Yes","No")', "Yes"), v('IF(G3<C3,"Expedite","Normal")', "Expedite"), v('IF(H3="Yes",F3+B3*C3-E3,0)', 130)],
            ["Pump seal", 5, 15, 25, 140, v("B4*C4+D4", 100), v("E4/B4", 28), v('IF(E4<F4,"Yes","No")', "No"), v('IF(G4<C4,"Expedite","Normal")', "Normal"), v('IF(H4="Yes",F4+B4*C4-E4,0)', 0)],
            ["Filter cartridge", 20, 7, 40, 150, v("B5*C5+D5", 180), v("E5/B5", 7.5), v('IF(E5<F5,"Yes","No")', "Yes"), v('IF(G5<C5,"Expedite","Normal")', "Normal"), v('IF(H5="Yes",F5+B5*C5-E5,0)', 170)],
            [],
            ["Order quantity = ROP + lead-time demand − on hand (brings stock back above ROP after one cycle)."],
          ],
        },
      ],
    },
    q4: "1) Qualify a second, local valve-kit supplier able to deliver urgent orders in about 10 days. 2) Until then, raise the valve-kit safety stock from 30 to 45 units (15 days of use), or agree consignment stock held at our warehouse.",
  },
  {
    job: "sipchem-supply",
    candidate: "lujain.alomari@jadarah.example",
    quality: "partial",
    mcq: 1,
    q2: "Catalyst X ROP is 240 so we have 250 and do not need to order. Valve kit ROP is 90, we have 80 so order. Pump seal ROP 75, fine. Filter ROP 140, we have 150 so fine.",
    q3: {
      kind: "xlsx",
      sheets: [
        {
          name: "ROP",
          rows: [
            ["Item", "Daily use", "Lead time", "On hand", "ROP"],
            ["Catalyst X", 12, 20, 250, v("B2*C2", 240)],
            ["Valve kit", 3, 30, 80, v("B3*C3", 90)],
            ["Pump seal", 5, 15, 140, v("B4*C4", 75)],
            ["Filter cartridge", 20, 7, 150, v("B5*C5", 140)],
          ],
        },
      ],
    },
    q4: "",
  },
  // ---------------------------------------------------------------- SRSA Operations
  {
    job: "srsa-ops",
    candidate: "bandar.alzahrani@jadarah.example",
    quality: "good",
    mcq: 0,
    q2: "1) Environmental review — 9 days, the longest step (39% of 23 days). It waits for the document check to finish even though it only needs the vessel and site information. 2) Waiting for an inspector — 4 of the 6 inspection days are queue time, so the problem is inspector scheduling, not the inspection itself. 3) Document rework — 35% of files are sent back for missing papers; applicants have no clear checklist. Manual bank payment adds another 2 days.",
    q3: {
      kind: "docx",
      lines: [
        "Improved berth permit process",
        "1. Online application with a required-documents checklist and automatic completeness check (document check 4 → 2 days).",
        "2. Environmental review starts right after intake and runs at the same time as the safety inspection (review 9 → 7 days with a standard template).",
        "3. Inspection booked at submission from a shared inspector calendar (6 → 2 days).",
        "4. Online payment (2 → 1 day) and automatic permit issue (1 day).",
        "Expected total: 1 + 2 + 7 (inspection runs in parallel) + 1 + 1 = 12 days. Further reduction of the environmental review is needed to reach 10.",
        "KPIs: turnaround time, rework rate, inspection waiting time.",
      ],
    },
    q4: "Average permit time ≤ 12 days in the first quarter, then ≤ 10; rework rate ≤ 15%; inspection waiting ≤ 2 days.",
  },
  {
    job: "srsa-ops",
    candidate: "turki.alsubaie@jadarah.example",
    quality: "weak",
    mcq: 3,
    q2: "The process is too long. We need more employees.",
    q3: { kind: "docx", lines: ["New process", "Hire more staff and work faster to finish in 10 days."] },
    q4: "Time.",
  },
  // ---------------------------------------------------------------- MoF Budget
  {
    job: "mof-budget",
    candidate: "turki.alsubaie@jadarah.example",
    quality: "excellent",
    mcq: 0,
    q2: "Digital services: +18 m (+15.0%) — overspend, flagged. Ask what drove it (new services, licences, contracts brought forward) and whether the full-year forecast must rise.\nInfrastructure maintenance: −45 m (−15.0%) — underspend, flagged. Ask whether maintenance contracts are delayed (timing — the money will be needed later) or whether this is a real saving.\nGrants: −40 m (−20.0%) — underspend, flagged. Ask whether disbursements are held up and whether beneficiaries are affected.\nTraining: +2 m (+4.4%) — within the ±10% tolerance, no explanation required.\nTotal: budget 665 m, actual 600 m, −65 m (−9.8%) net underspend.",
    q3: {
      kind: "xlsx",
      sheets: [
        {
          name: "Variance",
          rows: [
            ["Program", "Budget", "Actual", "Variance", "Variance %", "Flag (>±10%)", "Comment"],
            ["Digital services", 120, 138, v("C2-B2", 18), v("D2/B2*100", 15), v('IF(ABS(E2)>10,"Explain","OK")', "Explain"), "Overspend — confirm drivers and update forecast"],
            ["Infrastructure maintenance", 300, 255, v("C3-B3", -45), v("D3/B3*100", -15), v('IF(ABS(E3)>10,"Explain","OK")', "Explain"), "Underspend — timing of contracts or saving?"],
            ["Training", 45, 47, v("C4-B4", 2), v("D4/B4*100", 4.44), v('IF(ABS(E4)>10,"Explain","OK")', "OK"), "Within tolerance"],
            ["Grants", 200, 160, v("C5-B5", -40), v("D5/B5*100", -20), v('IF(ABS(E5)>10,"Explain","OK")', "Explain"), "Underspend — disbursement delays?"],
            ["Total", v("SUM(B2:B5)", 665), v("SUM(C2:C5)", 600), v("C6-B6", -65), v("D6/B6*100", -9.77), v('IF(ABS(E6)>10,"Explain","OK")', "OK"), "Net underspend"],
          ],
        },
      ],
    },
    q4: "Do not move funds yet. First confirm with the Infrastructure and Grants owners whether their underspend is permanent. Fund the Digital overspend (about 18 m) only from the part confirmed as a saving, and ask Digital for a revised forecast so the overspend does not repeat next quarter.",
  },
  {
    job: "mof-budget",
    candidate: "reem.almutairi@jadarah.example",
    quality: "average",
    mcq: 0,
    q2: "Digital is over budget by 18 (15%). Infrastructure is under by 45 and Grants under by 40, which is good because we saved money. Training is +2. The total saving is 65 million.",
    q3: {
      kind: "xlsx",
      sheets: [
        {
          name: "Budget",
          rows: [
            ["Program", "Budget", "Actual", "Variance", "%"],
            ["Digital services", 120, 138, v("C2-B2", 18), v("D2/C2*100", 13.04)],
            ["Infrastructure maintenance", 300, 255, v("C3-B3", -45), v("D3/C3*100", -17.65)],
            ["Training", 45, 47, v("C4-B4", 2), v("D4/C4*100", 4.26)],
            ["Grants", 200, 160, v("C5-B5", -40), v("D5/C5*100", -25)],
          ],
        },
      ],
    },
    q4: "Move the 85 million saved from Infrastructure and Grants to Digital services next quarter.",
  },
  // ---------------------------------------------------------------- SIDF Audit
  {
    job: "sidf-audit",
    candidate: "reem.almutairi@jadarah.example",
    quality: "excellent",
    mcq: 0,
    q2: "Exceptions:\n- L-102 (6.5 m) — above 5 m but approved by a manager only (criterion 1).\n- L-108 (9.0 m) — above 5 m, manager approval only (criterion 1).\n- L-104 — 7.1 m disbursed against a 6.6 m invoice, 0.5 m overpaid (criterion 2).\n- L-105 — disbursed 2 March, approved 5 March: paid before approval (criterion 3).\nRates: 4 of 8 loans = 50% by count; 24.6 m of 39.1 m = 62.9% by value.\nRisk rating: High. 15.5 m was paid without the required committee approval, one payment exceeded the invoice and one was made before approval — the approval control is not enforced by the system.",
    q3: {
      kind: "xlsx",
      sheets: [
        {
          name: "Testing",
          rows: [
            ["Loan", "Amount", "Approver", "Invoice", "Disbursed", "Approved", "C1", "C2", "C3", "Exception"],
            ["L-101", 3.2, "Manager", 3.2, "2026-02-03", "2026-02-01", v('IF(OR(B2<=5,C2="Committee"),"Pass","Fail")', "Pass"), v('IF(B2=D2,"Pass","Fail")', "Pass"), v('IF(E2>=F2,"Pass","Fail")', "Pass"), v('IF(COUNTIF(G2:I2,"Fail")>0,"Yes","No")', "No")],
            ["L-102", 6.5, "Manager", 6.5, "2026-02-10", "2026-02-08", v('IF(OR(B3<=5,C3="Committee"),"Pass","Fail")', "Fail"), v('IF(B3=D3,"Pass","Fail")', "Pass"), v('IF(E3>=F3,"Pass","Fail")', "Pass"), v('IF(COUNTIF(G3:I3,"Fail")>0,"Yes","No")', "Yes")],
            ["L-103", 4.8, "Committee", 4.8, "2026-02-17", "2026-02-12", v('IF(OR(B4<=5,C4="Committee"),"Pass","Fail")', "Pass"), v('IF(B4=D4,"Pass","Fail")', "Pass"), v('IF(E4>=F4,"Pass","Fail")', "Pass"), v('IF(COUNTIF(G4:I4,"Fail")>0,"Yes","No")', "No")],
            ["L-104", 7.1, "Committee", 6.6, "2026-02-24", "2026-02-20", v('IF(OR(B5<=5,C5="Committee"),"Pass","Fail")', "Pass"), v('IF(B5=D5,"Pass","Fail")', "Fail"), v('IF(E5>=F5,"Pass","Fail")', "Pass"), v('IF(COUNTIF(G5:I5,"Fail")>0,"Yes","No")', "Yes")],
            ["L-105", 2.0, "Manager", 2.0, "2026-03-02", "2026-03-05", v('IF(OR(B6<=5,C6="Committee"),"Pass","Fail")', "Pass"), v('IF(B6=D6,"Pass","Fail")', "Pass"), v('IF(E6>=F6,"Pass","Fail")', "Fail"), v('IF(COUNTIF(G6:I6,"Fail")>0,"Yes","No")', "Yes")],
            ["L-106", 5.4, "Committee", 5.4, "2026-03-09", "2026-03-04", v('IF(OR(B7<=5,C7="Committee"),"Pass","Fail")', "Pass"), v('IF(B7=D7,"Pass","Fail")', "Pass"), v('IF(E7>=F7,"Pass","Fail")', "Pass"), v('IF(COUNTIF(G7:I7,"Fail")>0,"Yes","No")', "No")],
            ["L-107", 1.1, "Manager", 1.1, "2026-03-16", "2026-03-12", v('IF(OR(B8<=5,C8="Committee"),"Pass","Fail")', "Pass"), v('IF(B8=D8,"Pass","Fail")', "Pass"), v('IF(E8>=F8,"Pass","Fail")', "Pass"), v('IF(COUNTIF(G8:I8,"Fail")>0,"Yes","No")', "No")],
            ["L-108", 9.0, "Manager", 9.0, "2026-03-23", "2026-03-18", v('IF(OR(B9<=5,C9="Committee"),"Pass","Fail")', "Fail"), v('IF(B9=D9,"Pass","Fail")', "Pass"), v('IF(E9>=F9,"Pass","Fail")', "Pass"), v('IF(COUNTIF(G9:I9,"Fail")>0,"Yes","No")', "Yes")],
            [],
            ["Exceptions", v('COUNTIF(J2:J9,"Yes")', 4)],
            ["Rate by count %", v("B11/8*100", 50)],
            ["Exception value", v('SUMIF(J2:J9,"Yes",B2:B9)', 24.6)],
            ["Rate by value %", v("B13/SUM(B2:B9)*100", 62.92)],
            ["Criteria: C1 >5m needs Committee; C2 amount = invoice; C3 disbursed on/after approval (ISO dates compare as text)."],
          ],
        },
      ],
    },
    q4: "Condition: L-102 (6.5 m) and L-108 (9.0 m) were disbursed with manager approval only. Criteria: disbursements above SAR 5 m require Credit Committee approval. Cause: the financing system does not enforce approval limits by amount. Effect: 15.5 m disbursed without the required oversight, exposing the fund to unapproved credit risk. Recommendation: configure system approval limits by amount, and have the committee retrospectively review L-102 and L-108 within 30 days.",
  },
  {
    job: "sidf-audit",
    candidate: "bandar.alzahrani@jadarah.example",
    quality: "weak",
    mcq: 1,
    q2: "L-108 is a big loan approved by a manager which is wrong. The others look fine. Risk is medium.",
    q3: {
      kind: "xlsx",
      sheets: [
        {
          name: "Sheet1",
          rows: [
            ["Loan", "Amount", "Result"],
            ["L-101", 3.2, "OK"],
            ["L-102", 6.5, "OK"],
            ["L-108", 9.0, "Not OK"],
          ],
        },
      ],
    },
    q4: "The manager approved a large loan. This should be fixed.",
  },
];

/** Third applicant per job: left for live demonstration (assigned, or started and saved without submitting). */
export const LIVE: { job: string; candidate: string; state: "assigned" | "in_progress" }[] = [
  { job: "moc-legal", candidate: "shahad.alzahrani@jadarah.example", state: "assigned" },
  { job: "gea-pr", candidate: "aseel.alshammari@jadarah.example", state: "assigned" },
  { job: "elm-ta", candidate: "nouf.alqarni@jadarah.example", state: "assigned" },
  { job: "dgda-procurement", candidate: "salman.alotaibi@jadarah.example", state: "in_progress" },
  { job: "stc-cx", candidate: "naif.alqahtani@jadarah.example", state: "assigned" },
  { job: "sdaia-strategy", candidate: "abdulaziz.almalki@jadarah.example", state: "assigned" },
  { job: "sipchem-supply", candidate: "rakan.alharbi@jadarah.example", state: "assigned" },
  { job: "srsa-ops", candidate: "reem.alharbi@jadarah.example", state: "in_progress" },
  { job: "mof-budget", candidate: "mohammed.alghamdi@jadarah.example", state: "assigned" },
  { job: "sidf-audit", candidate: "maha.alsubaie@jadarah.example", state: "assigned" },
];
