/**
 * V-05 · V-09 — finance depth and the resource model.
 *
 * The finance business partner's three questions — capex or opex, in
 * which currency, committed or spent — and the one about people: a
 * fly-in engineer on rotation is not 1.0 FTE for fifty-two weeks.
 */

import { test, before, after } from "node:test";
import assert from "node:assert";
import { boot, shutdown, as, SITE_PROJECT_GRU } from "./harness.js";
import { Engine } from "../../shared/engine.js";

before(async () => { await boot(); });
after(shutdown);

test("the money position separates spent from committed, and capex from opex", () => {
  const db = {
    ledger: [
      { project: "P1", amount: 3, kind: "capex", currency: "USD" },
      { project: "P1", amount: 1, kind: "opex", currency: "XOF" },
      { project: "PX", amount: 9, kind: "capex", currency: "USD" },   // out of slate
    ],
    commitments: [
      { project: "P1", amount: 2, kind: "capex", status: "Open", currency: "USD" },
      { project: "P1", amount: 1, kind: "opex", status: "Part received", currency: "USD" },
      { project: "P1", amount: 5, kind: "capex", status: "Cancelled", currency: "USD" },
      { project: "P1", amount: 4, kind: "capex", status: "Received", currency: "USD" },
    ],
  };
  const m = Engine.moneyPosition(db, [{ id: "P1", budget: 10 }]);
  assert.equal(m.spent, 4);
  assert.equal(m.committed, 3, "cancelled does not count; received has become a cost line");
  assert.equal(m.free, 3, "10 budget less 4 spent less 3 committed");
  assert.equal(m.capex.spent, 3);
  assert.equal(m.opex.spent, 1);
  assert.deepEqual(m.currencies, ["USD", "XOF"], "and it says which currencies are in play");
  assert.equal(m.overCommitted, false);

  const tight = Engine.moneyPosition(db, [{ id: "P1", budget: 5 }]);
  assert.equal(tight.overCommitted, true, "spent plus committed passes the budget");
});

test("availability is what a rotation leaves behind", () => {
  assert.equal(Engine.effectiveFte({ availability: 100 }), 1);
  assert.equal(Engine.effectiveFte({ availability: 67 }).toFixed(2), "0.67");
  assert.equal(Engine.effectiveFte(null), 0);
  assert.equal(Engine.effectiveFte({}), 1, "an unstated availability is full-time");
});

test("a commitment round-trips, and is corrected rather than frozen", async () => {
  const dch = await as("groupDCH");
  const made = await dch.post("/api/commitments", {
    project: SITE_PROJECT_GRU, reference: "PO-88421", supplier: "Orange Business",
    description: "Second VSAT link, 24 months", amount: 0.35, currency: "XOF",
    fx: 0.0016, kind: "opex", expectedOn: "2027-02-01",
  });
  assert.equal(made.status, 201, JSON.stringify(made.body));

  let c = (await dch.get("/api/bootstrap")).body.db.commitments.find(x => x.id === made.body.id);
  assert.equal(c.reference, "PO-88421");
  assert.equal(c.amount, 0.35);
  assert.equal(c.currency, "XOF");
  assert.equal(c.kind, "opex");
  assert.equal(c.status, "Open");

  const amended = await dch.patch("/api/commitments/" + c.id,
    { amount: 0.41, status: "Part received", version: c.version });
  assert.equal(amended.status, 200, JSON.stringify(amended.body));
  c = (await dch.get("/api/bootstrap")).body.db.commitments.find(x => x.id === made.body.id);
  assert.equal(c.amount, 0.41, "a purchase order is amended in the real world");
  assert.equal(c.status, "Part received");

  const gone = await dch.del("/api/commitments/" + c.id);
  assert.equal(gone.status, 200);
});

test("a site lead cannot commit the group's money", async () => {
  const pm = await as("siteGRU");
  const refused = await pm.post("/api/commitments", {
    project: SITE_PROJECT_GRU, reference: "PO-1", amount: 0.1,
  });
  assert.equal(refused.status, 403, "cost.write is group authority");
});

test("a cost line carries capex/opex and the currency it was spent in", async () => {
  const dch = await as("groupDCH");
  const booked = await dch.post("/api/cost", {
    project: SITE_PROJECT_GRU, amount: 0.12, period: "2026-08",
    kind: "opex", currency: "XOF", fx: 0.0016, amountLocal: 75,
    category: "Licences", note: "Annual support",
  });
  assert.equal(booked.status, 201, JSON.stringify(booked.body));

  const line = (await dch.get("/api/bootstrap")).body.db.ledger
    .filter(l => l.project === SITE_PROJECT_GRU).slice(-1)[0];
  assert.equal(line.kind, "opex");
  assert.equal(line.currency, "XOF");
  assert.equal(line.amountLocal, 75, "what was actually spent, before conversion");
  assert.equal(line.fx, 0.0016);
});

test("a person carries how they actually work, and effort says whether it capitalises", async () => {
  const admin = await as("admin");
  const db = (await admin.get("/api/bootstrap")).body.db;
  const person = db.people[0];
  assert.equal(person.employment, "staff", "a sensible default");
  assert.equal(person.availability, 100);

  const patched = await admin.patch("/api/admin/people/" + person.id, {
    employment: "contractor", rotation: "4/2", availability: 67,
    supplier: "Sabodala Contracting", version: person.version,
  });
  assert.equal(patched.status, 200, JSON.stringify(patched.body));

  const after = (await admin.get("/api/bootstrap")).body.db.people.find(p => p.id === person.id);
  assert.equal(after.employment, "contractor");
  assert.equal(after.rotation, "4/2");
  assert.equal(after.availability, 67);
  assert.equal(Engine.effectiveFte(after).toFixed(2), "0.67");

  const alloc = (await admin.get("/api/bootstrap")).body.db.allocations[0];
  assert.equal(alloc.capitalised, true, "effort capitalises unless somebody says otherwise");
  const expensed = await admin.patch("/api/allocations/" + alloc.id,
    { capitalised: false, version: alloc.version });
  assert.equal(expensed.status, 200, JSON.stringify(expensed.body));
  const now = (await admin.get("/api/bootstrap")).body.db.allocations.find(a => a.id === alloc.id);
  assert.equal(now.capitalised, false);
});
