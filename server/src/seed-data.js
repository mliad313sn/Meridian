/**
 * SEED — the opening book, lifted verbatim from the v4 build.
 *
 * Reference data is authored; schedule, cost ledger and allocations are
 * generated from it, so every number the interface shows is computed from
 * something rather than typed in twice. The xorshift `rng` is seeded from
 * the project id, which is what makes a rebuild deterministic — and what
 * makes the test fixtures stable (D-05).
 *
 * Nothing in this file was rewritten. It was moved.
 */

import {
  D, iso, addDays, addMonths, days, monthKey, clamp, sum, by, GATES,
} from "../../shared/engine.js";

/* deterministic randomness (so a reset always rebuilds the same book) */
function rng(seed) {
  let s0 = seed >>> 0;
  return function () { s0 ^= s0 << 13; s0 ^= s0 >>> 17; s0 ^= s0 << 5; return ((s0 >>> 0) % 100000) / 100000; };
}
let _seq = 1000;
const uid = () => "u" + (++_seq) + Math.floor(Math.random() * 1e5).toString(36);

const SITES = [
  { id: "LON", city: "London",    region: "UK & Ireland",   tz: 0,    tzName: "GMT", headcount: 86,  fte: 78,  role: "Portfolio HQ · steering committee seat" },
  { id: "KRK", city: "Kraków",    region: "Central Europe", tz: 1,    tzName: "CET", headcount: 142, fte: 131, role: "Engineering hub · payments & core" },
  { id: "LIS", city: "Lisbon",    region: "Iberia",         tz: 0,    tzName: "WET", headcount: 74,  fte: 69,  role: "Channels & design system" },
  { id: "BER", city: "Berlin",    region: "DACH",           tz: 1,    tzName: "CET", headcount: 58,  fte: 54,  role: "Infrastructure & security" },
  { id: "BLR", city: "Bengaluru", region: "India",          tz: 5.5,  tzName: "IST", headcount: 210, fte: 196, role: "Data, AI and platform engineering" },
  { id: "YYZ", city: "Toronto",   region: "North America",  tz: -5,   tzName: "EST", headcount: 64,  fte: 58,  role: "Branch systems & change management" },
  { id: "GRU", city: "São Paulo", region: "LATAM",          tz: -3,   tzName: "BRT", headcount: 39,  fte: 35,  role: "Regional rollout & localisation" },
  { id: "SIN", city: "Singapore", region: "APAC",           tz: 8,    tzName: "SGT", headcount: 47,  fte: 44,  role: "Follow-the-sun operations coverage" },
];

const PROGRAMMES = [
  { id: "CBP", name: "Core Banking Platform", sponsor: "Group COO",   managerId: "PE-15" },
  { id: "DCH", name: "Digital Channels",      sponsor: "Chief Customer Officer", managerId: "PE-16" },
  { id: "DAI", name: "Data & AI",             sponsor: "Chief Data Officer",     managerId: "PE-18" },
  { id: "EIT", name: "Enterprise IT",         sponsor: "Group CIO",              managerId: "PE-17" },
];

const PEOPLE = [
  { id: "PE-01", name: "D. Osei",       role: "Project manager",       site: "KRK", rate: 780 },
  { id: "PE-02", name: "L. Moreau",     role: "Project manager",       site: "LIS", rate: 760 },
  { id: "PE-03", name: "S. Ibarra",     role: "Data lead",             site: "BLR", rate: 640 },
  { id: "PE-04", name: "T. Nakamura",   role: "Project manager",       site: "YYZ", rate: 810 },
  { id: "PE-05", name: "A. Bekele",     role: "Project manager",       site: "BLR", rate: 620 },
  { id: "PE-06", name: "M. Fischer",    role: "Infrastructure lead",   site: "BER", rate: 790 },
  { id: "PE-07", name: "C. Whitfield",  role: "Project manager",       site: "LON", rate: 860 },
  { id: "PE-08", name: "R. Adeyemi",    role: "Change manager",        site: "YYZ", rate: 700 },
  { id: "PE-09", name: "A. Villalobos", role: "Solution architect",    site: "LIS", rate: 820 },
  { id: "PE-10", name: "K. Owusu",      role: "Delivery lead",         site: "KRK", rate: 690 },
  { id: "PE-11", name: "H. Petrov",     role: "QA lead",               site: "KRK", rate: 610 },
  { id: "PE-12", name: "N. Rahimi",     role: "Business analyst",      site: "LIS", rate: 560 },
  { id: "PE-13", name: "J. Sørensen",   role: "Product owner",         site: "LIS", rate: 740 },
  { id: "PE-14", name: "R. Kaur",       role: "PMO director",          site: "LON", rate: 940 },
  { id: "PE-15", name: "E. Lindqvist",  role: "Programme manager",     site: "LON", rate: 880 },
  { id: "PE-16", name: "P. Marchetti",  role: "Programme manager",     site: "BER", rate: 850 },
  { id: "PE-17", name: "Y. Tanaka",     role: "Programme manager",     site: "SIN", rate: 830 },
  { id: "PE-18", name: "F. Okonkwo",    role: "Programme manager",     site: "BLR", rate: 700 },
  { id: "PE-19", name: "G. Silva",      role: "Delivery lead",         site: "GRU", rate: 520 },
  { id: "PE-20", name: "W. Chen",       role: "Security architect",    site: "SIN", rate: 800 },
  { id: "PE-21", name: "I. Novak",      role: "Data engineer",         site: "KRK", rate: 590 },
  { id: "PE-22", name: "B. Haddad",     role: "Business analyst",      site: "BLR", rate: 470 },
  { id: "PE-23", name: "O. Dlamini",    role: "QA lead",               site: "BLR", rate: 480 },
  { id: "PE-24", name: "Z. Kowalski",   role: "Engineering manager",   site: "KRK", rate: 720 },
  { id: "PE-25", name: "V. Rossi",      role: "Finance business partner", site: "LON", rate: 810 },
  { id: "PE-26", name: "U. Sharma",     role: "Release manager",       site: "BLR", rate: 550 },
  { id: "PE-27", name: "N. Costa",      role: "UX lead",               site: "LIS", rate: 650 },
  { id: "PE-28", name: "Q. Mbeki",      role: "Operations lead",       site: "GRU", rate: 500 },
];

/* Projects. `perf` shapes the generated actuals — schedule and cost
   pressure — which the engine then measures back out as SPI and CPI. */
const PROJECTS = [
  { id: "PRJ-101", name: "Payments Core Migration",      prog: "CBP", site: "KRK", pm: "PE-01", method: "Hybrid",    start: "2026-02-04", finish: "2027-03-12", baseline: "2027-01-29", budget: 8.4, contingency: 1.10, perf: { sched: 0.86, cost: 0.93 },
    desc: "Moves settlement, clearing and the payment ledger off the 1998 mainframe stack onto the ISO 20022 platform, one payment type at a time, with a dual-run window before each decommission." },
  { id: "PRJ-104", name: "Unified Customer Onboarding",  prog: "DCH", site: "LIS", pm: "PE-02", method: "Agile",     start: "2026-01-06", finish: "2026-11-28", baseline: "2026-11-28", budget: 5.2, contingency: 0.52, perf: { sched: 0.94, cost: 1.02 },
    desc: "Consolidates six channel-specific onboarding journeys into one orchestrated flow with shared KYC, decisioning and document capture. Delivered agile inside a stage-gated funding envelope." },
  { id: "PRJ-107", name: "Data Lakehouse Consolidation", prog: "DAI", site: "BLR", pm: "PE-03", method: "Hybrid",    start: "2025-11-12", finish: "2026-12-19", baseline: "2026-12-19", budget: 6.8, contingency: 0.60, perf: { sched: 1.04, cost: 1.06 },
    desc: "Retires eleven regional warehouses into one governed lakehouse with a shared semantic layer, so the same revenue number is the same number in every region." },
  { id: "PRJ-112", name: "Branch Teller Replacement",    prog: "DCH", site: "YYZ", pm: "PE-04", method: "Waterfall", start: "2026-06-02", finish: "2027-06-30", baseline: "2027-07-14", budget: 4.1, contingency: 0.45, perf: { sched: 0.93, cost: 0.99 },
    desc: "Replaces the branch teller application and its hardware estate across 340 branches, with an offline mode for sites on unreliable connectivity." },
  { id: "PRJ-118", name: "Fraud Decisioning Engine",     prog: "DAI", site: "BLR", pm: "PE-05", method: "Agile",     start: "2026-01-19", finish: "2027-04-14", baseline: "2027-04-14", budget: 3.6, contingency: 0.36, perf: { sched: 1.01, cost: 1.04 },
    desc: "Real-time scoring service for card, transfer and onboarding events, replacing three rules engines with one model-served decision API." },
  { id: "PRJ-121", name: "Zero-Trust Network Rollout",   prog: "EIT", site: "BER", pm: "PE-06", method: "Hybrid",    start: "2026-03-03", finish: "2027-09-25", baseline: "2027-08-27", budget: 5.9, contingency: 0.70, perf: { sched: 0.95, cost: 0.90 },
    desc: "Removes implicit network trust across every site and branch: identity-aware proxies, device posture checks and segmentation, delivered site by site." },
  { id: "PRJ-125", name: "Regulatory Reporting Uplift",  prog: "CBP", site: "LON", pm: "PE-07", method: "Waterfall", start: "2026-07-01", finish: "2028-02-11", baseline: "2028-02-11", budget: 2.9, contingency: 0.29, perf: { sched: 1.00, cost: 1.00 },
    desc: "Rebuilds statutory and prudential reporting on the new ledger, ahead of the 2028 reporting standard change." },
  { id: "PRJ-129", name: "Workplace Device Refresh",     prog: "EIT", site: "YYZ", pm: "PE-08", method: "Waterfall", start: "2025-09-15", finish: "2026-09-30", baseline: "2026-11-13", budget: 2.4, contingency: 0.12, perf: { sched: 1.02, cost: 1.09 },
    desc: "Four-thousand-seat laptop and peripheral refresh with a managed disposal chain. In closure: benefits review is the last open item." },
  { id: "PRJ-133", name: "Treasury Liquidity Dashboard", prog: "DAI", site: "SIN", pm: "PE-17", method: "Agile",     start: "2026-04-06", finish: "2027-01-29", baseline: "2027-01-29", budget: 2.2, contingency: 0.22, perf: { sched: 0.99, cost: 1.01 },
    desc: "Intraday liquidity position across eleven entities and four currencies, refreshed every fifteen minutes instead of overnight." },
  { id: "PRJ-136", name: "LATAM Localisation Wave",      prog: "DCH", site: "GRU", pm: "PE-19", method: "Hybrid",    start: "2026-05-11", finish: "2027-05-14", baseline: "2027-05-14", budget: 1.8, contingency: 0.20, perf: { sched: 0.91, cost: 0.97 },
    desc: "Brings the onboarding and channel stack into Brazil and Mexico: local identity evidence, PIX and SPEI rails, Portuguese and Spanish content." },
  { id: "PRJ-140", name: "Core Ledger Decommission",     prog: "CBP", site: "KRK", pm: "PE-24", method: "Waterfall", start: "2026-08-03", finish: "2028-06-30", baseline: "2028-06-30", budget: 3.4, contingency: 0.34, perf: { sched: 1.00, cost: 1.00 },
    desc: "Retires the legacy ledger and its 214 downstream feeds once payments migration completes. Currently in initiation; funding released to Gate 1 only." },
  { id: "PRJ-144", name: "Identity & Access Modernisation", prog: "EIT", site: "SIN", pm: "PE-20", method: "Hybrid", start: "2026-02-16", finish: "2027-07-30", baseline: "2027-07-30", budget: 4.6, contingency: 0.46, perf: { sched: 0.97, cost: 0.95 },
    desc: "One identity fabric for staff, contractors and service accounts, with joiner-mover-leaver automation replacing eleven manual provisioning paths." },
];

/* Work-breakdown templates. off/dur are fractions of the project window,
   w is the share of budget the stage carries. */
const WBS = {
  Waterfall: [
    { n: "Initiation & business case", w: .05, off: 0,    dur: .09, dep: [] },
    { n: "Requirements & scope",       w: .10, off: .08,  dur: .14, dep: [0] },
    { n: "Solution design",            w: .12, off: .20,  dur: .17, dep: [1] },
    { n: "Environments & tooling",     w: .05, off: .22,  dur: .18, dep: [1] },
    { n: "Build",                      w: .25, off: .35,  dur: .27, dep: [2] },
    { n: "Integration & system test",  w: .16, off: .60,  dur: .16, dep: [4] },
    { n: "User acceptance & readiness",w: .11, off: .74,  dur: .13, dep: [5] },
    { n: "Deployment & cutover",       w: .10, off: .86,  dur: .09, dep: [6, 3] },
    { n: "Benefits & closure",         w: .06, off: .94,  dur: .06, dep: [7] },
  ],
  Agile: [
    { n: "Discovery & inception",      w: .08, off: 0,    dur: .11, dep: [] },
    { n: "Architecture runway",        w: .10, off: .08,  dur: .15, dep: [0] },
    { n: "MVP increments",             w: .24, off: .21,  dur: .25, dep: [1] },
    { n: "Scale-up increments",        w: .22, off: .44,  dur: .24, dep: [2] },
    { n: "Compliance evidence",        w: .06, off: .34,  dur: .30, dep: [1] },
    { n: "Hardening & release readiness", w: .12, off: .66, dur: .15, dep: [3, 4] },
    { n: "Pilot & early life",         w: .11, off: .78,  dur: .13, dep: [5] },
    { n: "Rollout & handover",         w: .07, off: .88,  dur: .12, dep: [6] },
  ],
  Hybrid: [
    { n: "Mobilisation",               w: .06, off: 0,    dur: .09, dep: [] },
    { n: "Target architecture",        w: .11, off: .06,  dur: .17, dep: [0] },
    { n: "Foundation build",           w: .21, off: .21,  dur: .24, dep: [1] },
    { n: "Parallel delivery squads",   w: .19, off: .40,  dur: .26, dep: [2] },
    { n: "Change & operational readiness", w: .06, off: .44, dur: .28, dep: [1] },
    { n: "Migration waves",            w: .17, off: .62,  dur: .21, dep: [3] },
    { n: "Dual-run & assurance",       w: .13, off: .80,  dur: .13, dep: [5, 4] },
    { n: "Decommission & closure",     w: .07, off: .90,  dur: .10, dep: [6] },
  ],
};


const PHASES = ["Initiation", "Design", "Execution", "Transition", "Closure", "Closed"];
const DOC_TYPES = ["Charter", "Business case", "Design", "Assurance", "Quality", "Operations", "Compliance", "Closure", "Finance"];
const RAID_TYPES = ["Risk", "Issue", "Assumption", "Dependency"];
const RESPONSES = ["Mitigate", "Avoid", "Transfer", "Accept", "Monitor", "Fix"];
const COLUMNS = [
  { id: "backlog", name: "Backlog",          wip: 0 },
  { id: "progress", name: "In progress",     wip: 4 },
  { id: "review",  name: "In review",        wip: 4 },
  { id: "ready",   name: "Ready to release", wip: 3 },
  { id: "done",    name: "Done",             wip: 0 },
];

/* ── authored registers ───────────────────────────────────────────── */

const SEED_RAID = [
  { id: "RSK-03", type: "Risk", project: "PRJ-101", title: "ISO 20022 mapping incomplete for cross-border payments", p: 4, i: 5, response: "Mitigate", owner: "PE-01", opened: "2026-03-18", review: "2026-08-14", status: "Open",
    detail: "Sixteen cross-border message variants have no agreed mapping. Correspondent banks are still returning pacs.008 rejections in the test corridor." },
  { id: "RSK-05", type: "Risk", project: "PRJ-112", title: "Hardware lead times on teller devices", p: 2, i: 3, response: "Accept", owner: "PE-04", opened: "2026-06-20", review: "2026-09-01", status: "Closed",
    detail: "Vendor confirmed 14-week lead time against an 18-week float. Closed after the framework order was placed." },
  { id: "RSK-09", type: "Risk", project: "PRJ-107", title: "Data residency ruling may block EU lakehouse tenancy", p: 2, i: 5, response: "Avoid", owner: "PE-03", opened: "2026-02-11", review: "2026-08-29", status: "Open",
    detail: "A pending ruling could require EU-origin transaction features to stay in-region. Contingency is a second regional tenancy, costed at $1.1M." },
  { id: "RSK-14", type: "Risk", project: "PRJ-104", title: "KYC vendor SLA below contracted 99.5%", p: 4, i: 4, response: "Mitigate", owner: "PE-02", opened: "2026-05-02", review: "2026-08-12", status: "Open",
    detail: "Rolling 30-day availability is 98.7%. Vendor has committed to a capacity uplift; a second provider is being qualified as a fallback." },
  { id: "RSK-21", type: "Risk", project: null, title: "Two senior business analysts roll off at the end of Q3", p: 3, i: 3, response: "Transfer", owner: "PE-14", opened: "2026-06-30", review: "2026-08-20", status: "Open",
    detail: "Affects onboarding, lakehouse and regulatory reporting simultaneously. PMO to broker replacements from the Bengaluru bench." },
  { id: "RSK-27", type: "Risk", project: "PRJ-118", title: "Model drift in fraud scoring after threshold tuning", p: 3, i: 4, response: "Monitor", owner: "PE-05", opened: "2026-04-24", review: "2026-08-18", status: "Open",
    detail: "False-positive rate moved 0.4pp after the June tuning pass. Champion-challenger monitoring in place; retrain trigger set at 1pp." },
  { id: "RSK-31", type: "Risk", project: "PRJ-121", title: "Branch segmentation window collides with quarter-end", p: 3, i: 4, response: "Mitigate", owner: "PE-06", opened: "2026-07-08", review: "2026-08-25", status: "Open",
    detail: "Wave 4 lands in the last week of September. Requesting a move into October to keep the change freeze intact." },
  { id: "RSK-34", type: "Risk", project: "PRJ-144", title: "Service-account inventory incomplete across LATAM", p: 4, i: 3, response: "Mitigate", owner: "PE-20", opened: "2026-06-02", review: "2026-08-16", status: "Open",
    detail: "Roughly 900 service accounts have no named owner. Automated discovery is running; unowned accounts will be quarantined before cutover." },
  { id: "RSK-38", type: "Risk", project: "PRJ-136", title: "PIX certification slot not yet confirmed", p: 3, i: 4, response: "Mitigate", owner: "PE-19", opened: "2026-07-15", review: "2026-08-30", status: "Open",
    detail: "Certification windows are allocated quarterly. Missing the November slot pushes launch to February." },
  { id: "RSK-41", type: "Risk", project: "PRJ-125", title: "Reporting standard interpretation still under consultation", p: 3, i: 3, response: "Monitor", owner: "PE-07", opened: "2026-07-20", review: "2026-09-10", status: "Open",
    detail: "Two disclosure requirements remain open in the consultation. Design is being kept deliberately parameterised until the final text lands." },
  { id: "ISS-07", type: "Issue", project: "PRJ-104", title: "Document capture failing on iOS 19 beta", p: 5, i: 2, response: "Fix", owner: "PE-10", opened: "2026-07-29", review: "2026-08-12", status: "Open",
    detail: "Camera permissions API change breaks the capture step for about 3% of pilot users. Fix is in review with the mobile guild." },
  { id: "ISS-11", type: "Issue", project: "PRJ-121", title: "Network segmentation broke branch printing", p: 5, i: 3, response: "Fix", owner: "PE-06", opened: "2026-07-11", review: "2026-08-11", status: "Open",
    detail: "Print servers sat outside the identity-aware proxy policy. Rule change is written and awaiting the Thursday change window." },
  { id: "ISS-15", type: "Issue", project: "PRJ-107", title: "Semantic layer revenue figure differs from finance close", p: 4, i: 4, response: "Fix", owner: "PE-21", opened: "2026-08-01", review: "2026-08-15", status: "Open",
    detail: "A $2.1M gap traced to intercompany elimination timing. Finance and data engineering are reconciling the two definitions." },
  { id: "ISS-19", type: "Issue", project: "PRJ-101", title: "Settlement batch retry storm in the corridor test", p: 4, i: 4, response: "Fix", owner: "PE-10", opened: "2026-08-04", review: "2026-08-13", status: "Open",
    detail: "An unbounded retry policy generated 40k duplicate submissions in the test corridor. Backoff policy is being redesigned." },
  { id: "ISS-22", type: "Issue", project: "PRJ-129", title: "Disposal certificates missing for 180 devices", p: 3, i: 2, response: "Fix", owner: "PE-08", opened: "2026-07-02", review: "2026-08-22", status: "Open",
    detail: "The disposal partner has not returned destruction certificates for the March batch. Required before closure evidence can be signed." },
  { id: "ASM-02", type: "Assumption", project: "PRJ-104", title: "Regulator accepts digital-only identity evidence", p: 2, i: 5, response: "Monitor", owner: "PE-02", opened: "2026-02-14", review: "2026-08-21", status: "Open",
    detail: "Validated in writing on 22 June. Must be re-tested before Gate 3 because the guidance is under review." },
  { id: "ASM-04", type: "Assumption", project: "PRJ-101", title: "Correspondent banks complete their own ISO migration on time", p: 3, i: 4, response: "Monitor", owner: "PE-01", opened: "2026-03-02", review: "2026-09-01", status: "Open",
    detail: "Two of nine correspondents have not published a cutover date. Fallback is an extended translation layer." },
  { id: "ASM-06", type: "Assumption", project: "PRJ-140", title: "No downstream consumer needs the legacy ledger past 2028", p: 3, i: 5, response: "Monitor", owner: "PE-24", opened: "2026-08-03", review: "2026-10-01", status: "Open",
    detail: "214 feeds identified; 19 have no confirmed owner. Discovery continues through initiation." },
  { id: "DEP-01", type: "Dependency", project: "PRJ-104", title: "Fraud scoring API from PRJ-118", p: 4, i: 4, response: "Mitigate", owner: "PE-05", opened: "2026-04-01", review: "2026-08-19", status: "Open",
    detail: "Needed by 02 Sep for wave 1. Currently tracking to 09 Sep — one week of float remains before the migration date moves." },
  { id: "DEP-03", type: "Dependency", project: "PRJ-125", title: "New ledger data contract from PRJ-101", p: 3, i: 5, response: "Monitor", owner: "PE-01", opened: "2026-07-06", review: "2026-09-15", status: "Open",
    detail: "Reporting design cannot be baselined until the ledger's published contract is frozen." },
  { id: "DEP-05", type: "Dependency", project: "PRJ-136", title: "Onboarding wave 1 must ship before LATAM localisation", p: 3, i: 3, response: "Monitor", owner: "PE-19", opened: "2026-06-10", review: "2026-09-05", status: "Open",
    detail: "Localisation builds on the unified journey; a slip in PRJ-104 moves LATAM one-for-one." },
  { id: "DEP-07", type: "Dependency", project: "PRJ-144", title: "Identity fabric required for zero-trust wave 5", p: 3, i: 4, response: "Mitigate", owner: "PE-20", opened: "2026-05-20", review: "2026-08-27", status: "Open",
    detail: "Device posture checks depend on the new identity claims. Sequencing agreed with PRJ-121; joint dry run booked for October." },
  { id: "RSK-44", type: "Risk", project: "PRJ-133", title: "Fifteen-minute refresh may breach the source system's query budget", p: 3, i: 3, response: "Mitigate", owner: "PE-17", opened: "2026-06-18", review: "2026-08-26", status: "Open",
    detail: "Treasury's core system is licensed by query volume. A caching tier is being sized to keep inside the envelope." },
  { id: "ISS-24", type: "Issue", project: "PRJ-112", title: "Branch survey returned 41 sites with no cabinet space", p: 3, i: 3, response: "Fix", owner: "PE-04", opened: "2026-07-24", review: "2026-08-28", status: "Open",
    detail: "Design assumed a standard cabinet. 41 sites need a wall-mount variant, adding a procurement line." },
];

const SEED_CRS = [
  { id: "CR-218", project: "PRJ-101", title: "Add parallel-run window for the payments cutover", raisedBy: "PE-01", raised: "2026-07-28", cost: 0.64, weeks: 3, status: "Pending", funding: "Contingency",
    desc: "Operations require a four-week dual-run before the legacy settlement path is decommissioned. Adds infrastructure, a reconciliation squad and an extended change freeze.",
    riskDelta: "−2 High", stage: 2 },
  { id: "CR-214", project: "PRJ-112", title: "Descope offline branch mode from wave 1", raisedBy: "PE-04", raised: "2026-07-19", cost: -0.18, weeks: -2, status: "Approved", funding: "n/a",
    desc: "Offline teller mode moves to wave 2, releasing two engineers and pulling the wave 1 date forward.", riskDelta: "+1 Medium", stage: 4 },
  { id: "CR-211", project: "PRJ-107", title: "Extend lakehouse retention to seven years", raisedBy: "PE-03", raised: "2026-07-11", cost: 0.22, weeks: 0, status: "Approved", funding: "Programme",
    desc: "Regulatory counsel requires seven-year retention for transaction-derived features. Storage tiering absorbs most of the cost.", riskDelta: "−1 High", stage: 4 },
  { id: "CR-206", project: "PRJ-121", title: "Swap MFA vendor after the security review", raisedBy: "PE-06", raised: "2026-07-02", cost: 0.095, weeks: 1, status: "Rejected", funding: "Declined",
    desc: "The proposed vendor swap did not clear procurement; the incumbent will remediate under the existing contract instead.", riskDelta: "0", stage: 3 },
  { id: "CR-202", project: "PRJ-121", title: "Add two SRE roles to the zero-trust rollout", raisedBy: "PE-06", raised: "2026-06-24", cost: 0.31, weeks: 0, status: "Approved", funding: "Run budget",
    desc: "Sustained operations load after rollout requires two permanent SRE positions transferred from the run budget.", riskDelta: "−1 Medium", stage: 4 },
  { id: "CR-197", project: "PRJ-129", title: "Bring the benefits review forward one quarter", raisedBy: "PE-08", raised: "2026-06-12", cost: 0, weeks: -6, status: "Approved", funding: "n/a",
    desc: "Device refresh is finishing early; the benefits realisation review is pulled into Q3 to release the closure reserve.", riskDelta: "0", stage: 4 },
  { id: "CR-221", project: "PRJ-144", title: "Extend discovery to LATAM service accounts", raisedBy: "PE-20", raised: "2026-08-03", cost: 0.14, weeks: 2, status: "Pending", funding: "Project",
    desc: "Automated discovery found roughly 900 unowned service accounts in the LATAM estate. Two extra weeks of discovery and an owner-attestation campaign.",
    riskDelta: "−1 High", stage: 1 },
  { id: "CR-223", project: "PRJ-136", title: "Add SPEI rail to wave 1 scope", raisedBy: "PE-19", raised: "2026-08-05", cost: 0.26, weeks: 4, status: "Pending", funding: "Programme",
    desc: "Mexico launch is commercially dependent on SPEI at go-live rather than in wave 2. Adds a rail integration and a second certification cycle.",
    riskDelta: "+1 Medium", stage: 1 },
  { id: "CR-193", project: "PRJ-104", title: "Add a second KYC provider as a fallback", raisedBy: "PE-02", raised: "2026-06-05", cost: 0.19, weeks: 0, status: "Approved", funding: "Contingency",
    desc: "Qualifies a second identity provider so the journey can fail over when the incumbent breaches its availability SLA.", riskDelta: "−1 High", stage: 4 },
];

const CR_STEPS = [
  { role: "Project manager",   note: "Raised and impact-assessed" },
  { role: "Change authority",  note: "PMO review" },
  { role: "Finance",           note: "Funding release" },
  { role: "Steering committee",note: "Final approval" },
];

const SEED_DOCS = [
  { name: "Project charter",                    project: "PRJ-125", type: "Charter",       gate: 1, owner: "PE-07", rev: "1.2", status: "Approved",  updated: "2026-07-10" },
  { name: "Business case & benefits map",       project: "PRJ-125", type: "Business case", gate: 1, owner: "PE-25", rev: "2.0", status: "Approved",  updated: "2026-07-14" },
  { name: "Solution architecture dossier",      project: "PRJ-104", type: "Design",        gate: 2, owner: "PE-09", rev: "3.4", status: "Approved",  updated: "2026-04-12" },
  { name: "Production readiness review pack",   project: "PRJ-104", type: "Assurance",     gate: 3, owner: "PE-02", rev: "0.8", status: "In review", updated: "2026-08-05" },
  { name: "Test strategy & entry criteria",     project: "PRJ-101", type: "Quality",       gate: 3, owner: "PE-11", rev: "2.1", status: "In review", updated: "2026-08-01" },
  { name: "Cutover & rollback runbook",         project: "PRJ-101", type: "Operations",    gate: 3, owner: "PE-10", rev: "1.0", status: "Draft",     updated: "2026-08-06" },
  { name: "Data protection impact assessment",  project: "PRJ-107", type: "Compliance",    gate: 2, owner: "PE-03", rev: "1.6", status: "Approved",  updated: "2026-03-20" },
  { name: "Model governance record",            project: "PRJ-118", type: "Compliance",    gate: 3, owner: "PE-05", rev: "1.1", status: "In review", updated: "2026-07-28" },
  { name: "Benefits realisation report",        project: "PRJ-129", type: "Closure",       gate: 4, owner: "PE-08", rev: "1.0", status: "Draft",     updated: "2026-08-02" },
  { name: "Lessons learned register",           project: null,      type: "Closure",       gate: 4, owner: "PE-14", rev: "4.2", status: "Approved",  updated: "2026-07-31" },
  { name: "Segmentation design & wave plan",    project: "PRJ-121", type: "Design",        gate: 2, owner: "PE-06", rev: "2.3", status: "Approved",  updated: "2026-05-08" },
  { name: "Identity fabric target architecture",project: "PRJ-144", type: "Design",        gate: 2, owner: "PE-20", rev: "1.9", status: "Approved",  updated: "2026-05-26" },
  { name: "LATAM regulatory assessment",        project: "PRJ-136", type: "Compliance",    gate: 2, owner: "PE-19", rev: "0.6", status: "Draft",     updated: "2026-08-04" },
  { name: "Liquidity data contract",            project: "PRJ-133", type: "Design",        gate: 2, owner: "PE-17", rev: "1.3", status: "In review", updated: "2026-07-22" },
  { name: "Decommission discovery register",    project: "PRJ-140", type: "Charter",       gate: 1, owner: "PE-24", rev: "0.4", status: "Draft",     updated: "2026-08-06" },
  { name: "Portfolio cost baseline FY26",       project: null,      type: "Finance",       gate: 1, owner: "PE-25", rev: "3.0", status: "Approved",  updated: "2026-06-30" },
  { name: "Teller hardware specification",      project: "PRJ-112", type: "Design",        gate: 2, owner: "PE-04", rev: "1.4", status: "In review", updated: "2026-08-03" },
  { name: "Dual-run reconciliation procedure",  project: "PRJ-101", type: "Operations",    gate: 3, owner: "PE-10", rev: "0.5", status: "Draft",     updated: "2026-08-07" },
];

/* Kanban cards for the two projects that run a board. */
const SEED_ITEMS = [
  ["PRJ-101", "backlog",  "Idempotency keys on payment submit",        "PE-10", 8,  "P1"],
  ["PRJ-101", "backlog",  "Ledger reconciliation report v2",           "PE-12", 5,  "P2"],
  ["PRJ-101", "backlog",  "Retire legacy SOAP gateway",                "PE-09", 13, "P2"],
  ["PRJ-101", "backlog",  "Corridor test data refresh job",            "PE-21", 3,  "P3"],
  ["PRJ-101", "progress", "ISO 20022 message mapping",                 "PE-09", 13, "P1"],
  ["PRJ-101", "progress", "Settlement batch retry policy",             "PE-11", 5,  "P1"],
  ["PRJ-101", "progress", "Backoff and dead-letter for the retry storm","PE-10", 8,  "P1"],
  ["PRJ-101", "review",   "Dual-run comparison harness",               "PE-10", 8,  "P1"],
  ["PRJ-101", "review",   "Sanctions screening hook",                  "PE-13", 8,  "P2"],
  ["PRJ-101", "review",   "Throughput soak test",                      "PE-11", 3,  "P3"],
  ["PRJ-101", "ready",    "Payment status webhooks",                   "PE-12", 5,  "P2"],
  ["PRJ-101", "ready",    "Operations runbook for cutover",            "PE-01", 3,  "P1"],
  ["PRJ-101", "done",     "Card tokenisation service",                 "PE-09", 8,  "P1"],
  ["PRJ-101", "done",     "Audit trail retention policy",              "PE-13", 3,  "P3"],
  ["PRJ-101", "done",     "Mainframe adapter read path",               "PE-21", 8,  "P2"],

  ["PRJ-104", "backlog",  "Consent capture for marketing preferences", "PE-12", 3,  "P3"],
  ["PRJ-104", "backlog",  "Address lookup for Portugal and Spain",     "PE-27", 5,  "P2"],
  ["PRJ-104", "progress", "iOS 19 camera permission fix",              "PE-10", 5,  "P1"],
  ["PRJ-104", "progress", "Second KYC provider failover",              "PE-09", 13, "P1"],
  ["PRJ-104", "progress", "Gate 3 evidence pack assembly",             "PE-02", 8,  "P1"],
  ["PRJ-104", "progress", "Decisioning rules migration",               "PE-13", 8,  "P2"],
  ["PRJ-104", "progress", "Journey analytics instrumentation",         "PE-27", 5,  "P3"],
  ["PRJ-104", "review",   "Fraud API contract stub",                   "PE-05", 5,  "P1"],
  ["PRJ-104", "review",   "Document classifier threshold tuning",      "PE-22", 8,  "P2"],
  ["PRJ-104", "ready",    "Pilot cohort migration script",             "PE-26", 5,  "P1"],
  ["PRJ-104", "done",     "Shared KYC service cutover",                "PE-09", 13, "P1"],
  ["PRJ-104", "done",     "Unified journey shell",                     "PE-27", 8,  "P1"],
  ["PRJ-104", "done",     "Legacy journey traffic shadowing",          "PE-26", 5,  "P2"],

  ["PRJ-118", "backlog",  "Champion-challenger dashboard",             "PE-22", 5,  "P2"],
  ["PRJ-118", "progress", "Feature store latency budget",              "PE-03", 8,  "P1"],
  ["PRJ-118", "progress", "Retrain trigger on drift threshold",        "PE-05", 8,  "P1"],
  ["PRJ-118", "review",   "Scoring API contract v2",                   "PE-05", 5,  "P1"],
  ["PRJ-118", "ready",    "Model card and governance record",          "PE-23", 3,  "P2"],
  ["PRJ-118", "done",     "Card event stream ingestion",               "PE-21", 8,  "P1"],

  ["PRJ-107", "backlog",  "Deprecate warehouse #7 (LATAM)",            "PE-21", 8,  "P2"],
  ["PRJ-107", "progress", "Intercompany elimination reconciliation",   "PE-21", 8,  "P1"],
  ["PRJ-107", "progress", "Semantic layer revenue definition",         "PE-03", 5,  "P1"],
  ["PRJ-107", "review",   "Row-level security by entity",              "PE-22", 5,  "P2"],
  ["PRJ-107", "done",     "Governed catalogue rollout",                "PE-23", 5,  "P2"],
];

/* Extra hand-placed milestones beyond the four gates. */
const SEED_MILESTONES = [
  { project: "PRJ-104", name: "KYC service cutover (pilot cohort)", owner: "PE-02", date: "2026-05-29" },
  { project: "PRJ-104", name: "Retail channel migration wave 1",    owner: "PE-04", date: "2026-10-09" },
  { project: "PRJ-104", name: "Legacy journey decommission",        owner: "PE-06", date: "2026-11-14" },
  { project: "PRJ-101", name: "Corridor test complete",             owner: "PE-11", date: "2026-09-18" },
  { project: "PRJ-101", name: "First payment type cutover",         owner: "PE-01", date: "2026-12-04" },
  { project: "PRJ-101", name: "Legacy settlement decommission",     owner: "PE-10", date: "2027-02-19" },
  { project: "PRJ-118", name: "Scoring API handover to PRJ-104",    owner: "PE-05", date: "2026-09-02" },
  { project: "PRJ-121", name: "Branch wave 4 segmentation",         owner: "PE-06", date: "2026-09-25" },
  { project: "PRJ-107", name: "Warehouse 1–6 retired",              owner: "PE-03", date: "2026-09-11" },
  { project: "PRJ-129", name: "Final disposal certificates",        owner: "PE-08", date: "2026-08-28" },
  { project: "PRJ-112", name: "Pilot branch installation",          owner: "PE-04", date: "2027-01-15" },
  { project: "PRJ-144", name: "Joiner-mover-leaver automation live", owner: "PE-20", date: "2026-12-11" },
  { project: "PRJ-136", name: "PIX certification window",           owner: "PE-19", date: "2026-11-20" },
  { project: "PRJ-133", name: "Intraday feed in production",        owner: "PE-17", date: "2026-10-30" },
];

/* Cross-project dependency edges shown on the master schedule. */
const CROSS_DEPS = [
  { from: "PRJ-118", fromStage: 3, to: "PRJ-104", toStage: 3, label: "Fraud scoring API" },
  { from: "PRJ-101", fromStage: 5, to: "PRJ-125", toStage: 2, label: "Ledger data contract" },
  { from: "PRJ-104", fromStage: 6, to: "PRJ-136", toStage: 3, label: "Unified journey" },
  { from: "PRJ-144", fromStage: 3, to: "PRJ-121", toStage: 5, label: "Identity claims" },
  { from: "PRJ-101", fromStage: 7, to: "PRJ-140", toStage: 1, label: "Payments migrated" },
];

/* ── generators ───────────────────────────────────────────────────── */

/** Expand a project's WBS template into dated, dependency-linked activities. */
function genActivities(p, today) {
  const tpl = WBS[p.method];
  const span = days(p.start, p.finish);
  const r = rng(hashCode(p.id));
  return tpl.map((t, i) => {
    const jitter = (r() - 0.5) * 0.02;
    const start = addDays(p.start, Math.round((t.off + jitter) * span));
    const end = addDays(p.start, Math.round((t.off + t.dur + jitter) * span));
    const bStart = addDays(p.start, Math.round(t.off * span));
    const bEnd = addDays(p.start, Math.round((t.off + t.dur) * span));
    // planned progress by today, then bent by the project's schedule performance
    const planned = clamp(days(start, today) / Math.max(1, days(start, end)), 0, 1);
    let actual = planned <= 0 ? 0 : clamp(planned * (p.perf.sched + (r() - 0.5) * 0.09), 0, 1);
    if (planned >= 1 && p.perf.sched >= 1) actual = 1;
    if (planned >= 1 && actual > 0.97) actual = 1;
    return {
      id: p.id + "-A" + (i + 1), project: p.id, name: t.n, stage: i,
      start: iso(start), end: iso(end), baseStart: iso(bStart), baseEnd: iso(bEnd),
      weight: t.w, pct: Math.round(actual * 100), deps: t.dep.map(d => p.id + "-A" + (d + 1)),
      owner: p.pm,
    };
  });
}

/** Gate milestones + hand-placed ones, dated across the project window. */
function genMilestones(p) {
  const span = days(p.start, p.finish);
  const gates = GATES.map(g => ({
    id: p.id + "-G" + g.n, project: p.id, name: g.name, gate: g.n,
    date: iso(addDays(p.start, Math.round(g.at * span))),
    baseDate: iso(addDays(p.start, Math.round(g.at * span))),
    owner: p.pm, kind: "gate",
  }));
  const extra = SEED_MILESTONES.filter(m => m.project === p.id).map((m, i) => ({
    id: p.id + "-M" + (i + 1), project: p.id, name: m.name, gate: null,
    date: m.date, baseDate: m.date, owner: m.owner, kind: "milestone",
  }));
  return gates.concat(extra).sort(by("date"));
}

/**
 * Monthly cost ledger, shaped as an S-curve and then scaled so the cost
 * performance index lands where the project's profile says it should.
 * It is calibrated against the *same* earned value the engine computes —
 * the activity-weight sum — so seed and engine cannot drift apart.
 */
function genLedger(p, activities, today) {
  const out = [];
  const r = rng(hashCode(p.id) + 7);
  const span = days(p.start, p.finish);
  let m = D(monthKey(p.start) + "-01");
  const stop = D(monthKey(today) + "-01");
  const scurve = (x) => 1 / (1 + Math.exp(-9 * (x - 0.5)));
  let raw = 0;
  while (m <= stop) {
    const t0 = clamp(days(p.start, m) / span, 0, 1);
    const t1 = clamp(days(p.start, addMonths(m, 1)) / span, 0, 1);
    const share = (scurve(t1) - scurve(t0)) / (scurve(1) - scurve(0));
    let amount = p.budget * share * (1 + (r() - 0.5) * 0.12);
    if (monthKey(m) === monthKey(today)) amount *= D(today).getUTCDate() / 30;
    if (amount > 0.0005) { out.push({ project: p.id, period: monthKey(m), amount }); raw += amount; }
    m = addMonths(m, 1);
  }
  const ev = sum(activities, a => a.weight * (a.pct / 100) * p.budget);
  const targetAC = p.perf.cost > 0 ? ev / p.perf.cost : raw;
  const factor = raw > 0 && targetAC > 0 ? targetAC / raw : 1;
  return out.map(e => ({ project: e.project, period: e.period, amount: +(e.amount * factor).toFixed(4) }))
    .filter(e => e.amount > 0);
}

/** Allocate the delivery team across each project's window. */
/* Role slots per delivery method: which discipline, how much of a week it
   wants, and the slice of the project window it is needed for. */
const SLOTS = {
  Waterfall: [
    ["architect", 60, .02, .55], ["Delivery lead|Engineering manager", 80, .10, .92],
    ["Business analyst", 70, .05, .62], ["QA lead", 70, .40, .98], ["Change manager", 50, .55, 1],
  ],
  Agile: [
    ["Product owner", 60, .05, .95], ["architect", 60, .02, .50],
    ["Delivery lead|Engineering manager", 80, .12, .95], ["QA lead", 60, .35, .98], ["UX lead", 50, .05, .48],
  ],
  Hybrid: [
    ["architect", 60, .02, .55], ["Delivery lead|Engineering manager", 80, .10, .90],
    ["Data lead|Data engineer", 60, .15, .80], ["QA lead", 60, .40, .95],
    ["Release manager", 40, .70, 1], ["Operations lead", 40, .72, 1],
  ],
};

/* People deliberately pushed past their ceiling, so the capacity view has a
   real problem to find rather than a synthetic one. */
const OVERBOOKED = ["PE-09", "PE-11", "PE-06", "PE-26"];

/**
 * Allocations that respect capacity. A person is only put on a project if
 * they have room across every week of the window, so utilisation lands
 * where it should and over-allocation means something when it appears.
 */
function genAllocations(projects, today) {
  const out = [];
  const grid = new Map();                       // person → week index → committed %
  const wk = (d) => Math.floor(days("2025-01-01", d) / 7);
  const peak = (pid, from, to) => {
    const g = grid.get(pid); if (!g) return 0;
    let mx = 0;
    for (let w = wk(from); w <= wk(to); w++) mx = Math.max(mx, g.get(w) || 0);
    return mx;
  };
  const add = (pid, projectId, from, to, pct) => {
    out.push({ id: uid(), person: pid, project: projectId, pct, from, to });
    let g = grid.get(pid); if (!g) { g = new Map(); grid.set(pid, g); }
    for (let w = wk(from); w <= wk(to); w++) g.set(w, (g.get(w) || 0) + pct);
  };
  const win = (p, a, b) => {
    const span = days(p.start, p.finish);
    return [addDays(p.start, Math.round(span * a)), addDays(p.start, Math.round(span * b))];
  };

  const pms = projects.map(p => p.pm);
  // project managers first — they own their project end to end
  projects.forEach(p => add(p.pm, p.id, p.start, p.finish, 100));

  // programme managers take a slice of each project in their programme
  projects.forEach(p => {
    const prog = PROGRAMMES.find(x => x.id === p.programme);
    if (prog && prog.managerId && prog.managerId !== p.pm
        && peak(prog.managerId, p.start, p.finish) <= 80) add(prog.managerId, p.id, p.start, p.finish, 20);
  });

  // then the delivery roles, cheapest-loaded and closest-to-site first
  projects.forEach(p => {
    (SLOTS[p.method] || SLOTS.Hybrid).forEach(([role, want, a, b]) => {
      const [from, to] = win(p, a, b);
      const re = new RegExp(role, "i");
      const cands = PEOPLE
        .filter(x => re.test(x.role) && x.id !== p.pm && !pms.includes(x.id))
        .map(x => ({ x, load: peak(x.id, from, to), local: x.site === p.site ? 0 : 1 }))
        .sort((m, n) => m.load - n.load || m.local - n.local);
      const pick = cands.find(c => c.load <= 100 - 20);
      if (!pick) return;
      const pct = Math.min(want, Math.floor((100 - pick.load) / 10) * 10);
      if (pct >= 20) add(pick.x.id, p.id, from, to, pct);
    });
  });

  // and the deliberate pressure points
  OVERBOOKED.forEach((pid, i) => {
    const theirs = out.filter(a => a.person === pid);
    if (!theirs.length) return;
    const from = addDays(today, -7 * (i % 3));
    add(pid, theirs[theirs.length - 1].project, from, addDays(from, 55), 30 + i * 10);
  });

  return out;
}

function hashCode(str) { let hHash = 0; for (let i = 0; i < str.length; i++) { hHash = (hHash * 31 + str.charCodeAt(i)) | 0; } return Math.abs(hHash) || 1; }


export {
  SITES, PROGRAMMES, PEOPLE, PROJECTS, WBS, PHASES, DOC_TYPES, RAID_TYPES,
  RESPONSES, COLUMNS, SEED_RAID, SEED_CRS, CR_STEPS, SEED_DOCS, SEED_ITEMS,
  SEED_MILESTONES, CROSS_DEPS, SLOTS, OVERBOOKED,
  genActivities, genMilestones, genLedger, genAllocations, hashCode,
};
