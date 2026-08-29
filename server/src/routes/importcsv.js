/**
 * REPRISE DE L'EXISTANT (comité indépendant, R-09).
 *
 * L'organisation vit dans des tableurs, et aucun chemin ne menait des
 * tableurs à l'outil — le premier obstacle réel au déploiement. Trois
 * choses se reprennent vraiment : les projets, les personnes, les
 * jalons. Le contrat est celui que le comité a exigé :
 *
 *   · un MODÈLE téléchargeable par nature, pour ne pas deviner les
 *     colonnes ;
 *   · une PRÉVISUALISATION avant toute écriture — créera / refusera,
 *     ligne par ligne, avec le motif ;
 *   · un import TRANSACTIONNEL — tout ou rien ;
 *   · le compte rendu conservé dans la piste d'audit.
 *
 * Le parseur CSV est écrit ici (guillemets doublés, virgules dans les
 * cellules, BOM) plutôt qu'importé : le format qu'on accepte est un
 * contrat, pas une dépendance.
 */

import { Router } from "express";
import { one } from "../db.js";
import { can } from "../../../shared/rbac.js";
import { audited } from "../audit.js";
import { HttpError } from "../auth.js";
import { fromM } from "../portfolio.js";
import { scaffoldProject } from "../wbs.js";
import { allocateId } from "../db.js";
import { D } from "../../../shared/engine.js";

const r = Router();
export default r;

function gate(user, action) {
  const v = can(user, action);
  if (!v.ok) throw new HttpError(403, v.why);
}

/* ── CSV ──────────────────────────────────────────────────────────── */

export function parseCsv(text) {
  const src = String(text ?? "").replace(/^﻿/, "");
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  if (!rows.length) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((cells, i) => {
    const rec = { _line: i + 2 };
    header.forEach((h, j) => { rec[h] = (cells[j] ?? "").trim(); });
    return rec;
  });
  return { header, records };
}

/* ── les trois natures ────────────────────────────────────────────── */

const KINDS = {
  projects: {
    columns: ["name", "programme", "site", "governance", "pm", "start", "finish", "budget_m"],
    sample: `name,programme,site,governance,pm,start,finish,budget_m\r\n` +
      `"Remplacement pont bascule",DCH,GRU,site,PE-19,2027-01-11,2027-09-30,0.4\r\n`,
    async validate(rec, ctx) {
      const errs = [];
      if (!rec.name) errs.push("name manquant");
      if (!ctx.programmes.has(rec.programme)) errs.push(`programme inconnu « ${rec.programme} »`);
      if (!ctx.sites.has(rec.site)) errs.push(`site inconnu « ${rec.site} »`);
      if (rec.governance && !["site", "group"].includes(rec.governance)) errs.push("governance = site ou group");
      if (rec.pm && !ctx.people.has(rec.pm)) errs.push(`pm inconnu « ${rec.pm} »`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.start)) errs.push("start au format AAAA-MM-JJ");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.finish)) errs.push("finish au format AAAA-MM-JJ");
      if (!errs.length && D(rec.finish) < D(rec.start)) errs.push("finish avant start");
      if (rec.budget_m && !(Number(rec.budget_m) >= 0)) errs.push("budget_m n'est pas un nombre");
      return errs;
    },
    async apply(t, rec) {
      const id = await allocateId(t, "PRJ", { step: 3 });
      const level = rec.governance === "group" ? "group" : "site";
      await t.query(
        `INSERT INTO project (id, name, programme_id, site_id, governance_level, pm_id, method,
                              start_date, finish_date, baseline_finish, budget, contingency, description, phase)
         VALUES ($1,$2,$3,$4,$5,$6,'Hybrid',$7,$8,$8,$9,0,'','Initiation')`,
        [id, rec.name, rec.programme, rec.site, level, rec.pm || null,
         rec.start, rec.finish, fromM(Number(rec.budget_m || 0))]);
      await scaffoldProject(t, { id, name: rec.name, programme: rec.programme, site: rec.site,
        pm: rec.pm || null, method: "Hybrid", start: rec.start, finish: rec.finish });
      return id;
    },
  },

  people: {
    columns: ["name", "role", "site", "day_rate", "employment", "rotation", "availability"],
    sample: `name,role,site,day_rate,employment,rotation,availability\r\n` +
      `"A. Diallo","Network engineer",GRU,520,staff,4/2,67\r\n`,
    async validate(rec, ctx) {
      const errs = [];
      if (!rec.name) errs.push("name manquant");
      if (!ctx.sites.has(rec.site)) errs.push(`site inconnu « ${rec.site} »`);
      if (rec.employment && !["staff", "contractor"].includes(rec.employment)) errs.push("employment = staff ou contractor");
      if (rec.availability && !(Number(rec.availability) >= 0 && Number(rec.availability) <= 100)) {
        errs.push("availability entre 0 et 100");
      }
      if (rec.day_rate && !(Number(rec.day_rate) >= 0)) errs.push("day_rate n'est pas un nombre");
      return errs;
    },
    async apply(t, rec) {
      const id = await allocateId(t, "PE", { pad: 2 });
      await t.query(
        `INSERT INTO person (id, name, job_role, site_id, day_rate, employment, rotation, availability)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, rec.name, rec.role ?? "", rec.site, Number(rec.day_rate || 0),
         rec.employment === "contractor" ? "contractor" : "staff", rec.rotation ?? "",
         rec.availability === "" ? 100 : Math.round(Number(rec.availability))]);
      return id;
    },
  },

  milestones: {
    columns: ["project", "name", "date", "owner"],
    sample: `project,name,date,owner\r\n` +
      `PRJ-136,"Fenêtre de certification PIX",2026-11-20,PE-19\r\n`,
    async validate(rec, ctx) {
      const errs = [];
      if (!ctx.projects.has(rec.project)) errs.push(`projet inconnu « ${rec.project} »`);
      if (!rec.name) errs.push("name manquant");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.date)) errs.push("date au format AAAA-MM-JJ");
      if (rec.owner && !ctx.people.has(rec.owner)) errs.push(`owner inconnu « ${rec.owner} »`);
      return errs;
    },
    async apply(t, rec) {
      const n = await allocateId(t, "MS");
      const id = rec.project + "-M" + n.split("-")[1];
      await t.query(
        `INSERT INTO milestone (id, project_id, name, due_date, base_date, gate, kind, owner_id)
         VALUES ($1,$2,$3,$4,$4,NULL,'milestone',$5)`,
        [id, rec.project, rec.name, rec.date, rec.owner || null]);
      return id;
    },
  },
};

async function context(t) {
  const ids = async (sql) => new Set((await (t ? t.query(sql) : null))?.rows?.map((x) => x.id));
  void ids;
  const { many } = await import("../db.js");
  return {
    programmes: new Set((await many(`SELECT id FROM programme WHERE active`)).map((x) => x.id)),
    sites: new Set((await many(`SELECT id FROM site WHERE active`)).map((x) => x.id)),
    people: new Set((await many(`SELECT id FROM person WHERE active`)).map((x) => x.id)),
    projects: new Set((await many(`SELECT id FROM project`)).map((x) => x.id)),
  };
}

async function analyse(kindName, csv) {
  const kind = KINDS[kindName];
  if (!kind) throw new HttpError(400, "kind is projects, people or milestones");
  const { header, records } = parseCsv(csv);
  const missing = kind.columns.filter((c) => !header.includes(c) && !["governance", "pm", "budget_m", "day_rate", "employment", "rotation", "availability", "owner", "role"].includes(c));
  if (missing.length) {
    throw new HttpError(400, `colonnes manquantes : ${missing.join(", ")} — télécharger le modèle`);
  }
  const ctx = await context(null);
  const out = [];
  for (const rec of records) {
    const errs = await kind.validate(rec, ctx);
    out.push({ line: rec._line, record: rec, errors: errs, willCreate: !errs.length });
  }
  return { kind, rows: out };
}

/* ── routes ───────────────────────────────────────────────────────── */

r.get("/template", (req, res) => {
  const kind = KINDS[String(req.query.kind ?? "")];
  if (!kind) return res.status(400).json({ error: "kind is projects, people or milestones" });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="modele-${req.query.kind}.csv"`);
  res.send("﻿" + kind.sample);
});

r.post("/preview", async (req, res, next) => {
  try {
    gate(req.user, "data.import");
    const { rows } = await analyse(req.body?.kind, req.body?.csv);
    res.json({
      total: rows.length,
      creatable: rows.filter((x) => x.willCreate).length,
      refused: rows.filter((x) => !x.willCreate).length,
      rows: rows.map((x) => ({ line: x.line, name: x.record.name ?? x.record.project ?? "",
        errors: x.errors, willCreate: x.willCreate })),
    });
  } catch (e) { next(e); }
});

r.post("/apply", async (req, res, next) => {
  try {
    gate(req.user, "data.import");
    const { kind, rows } = await analyse(req.body?.kind, req.body?.csv);
    const bad = rows.filter((x) => !x.willCreate);
    /* Tout ou rien : un fichier qui porte une seule ligne fausse n'écrit
       RIEN — corriger le fichier, pas la base. */
    if (bad.length) {
      throw new HttpError(422,
        `${bad.length} ligne(s) refusée(s) — rien n'a été écrit. Première : ligne ${bad[0].line} : ${bad[0].errors.join(" ; ")}`);
    }
    if (!rows.length) throw new HttpError(400, "Le fichier ne contient aucune ligne");

    const created = [];
    await audited(req.user,
      () => ({ action: "Book imported from CSV", entity: "import", entityId: req.body.kind,
               detail: `${created.length} ${req.body.kind} créés depuis un fichier de ${rows.length} ligne(s)`,
               after: { ids: created } }),
      async (t) => {
        for (const x of rows) created.push(await kind.apply(t, x.record));
      });
    res.status(201).json({ created });
  } catch (e) { next(e); }
});
