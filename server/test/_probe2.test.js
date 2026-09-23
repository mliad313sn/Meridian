import { test, before, after } from "node:test";
import { readFileSync } from "node:fs";
import { boot, shutdown, as } from "./harness.js";
before(async () => { await boot(); });
after(async () => { await shutdown(); });
test("KODO's own book, unpatched", async () => {
  const admin = await as("admin");
  const payload = JSON.parse(readFileSync("/home/user/mliad313sn/kodo-by-kernel-project/delivery/meridian/kodo_import_payload.json", "utf8"));
  const bare = await admin.post("/api/admin/import", payload);
  console.log("KODO bare", bare.status, (bare.body?.error ?? JSON.stringify(bare.body)).slice(0, 200));
  const withUnit = await admin.post("/api/admin/import", { db: { ...payload.db, currencyUnit: "millions" } });
  console.log("KODO +unit", withUnit.status, JSON.stringify(withUnit.body).slice(0, 500));
  const ex = (await admin.get("/api/admin/export")).body;
  console.log("KODO export: projects", ex.projects.length, "requirements", ex.requirements?.length, "milestones", ex.milestones.length, "gates", JSON.stringify(ex.settings?.gates?.map(g=>[g.n,g.loopsTo??null,g.scope??null])));
  const back = await admin.post("/api/admin/import", ex);
  console.log("KODO round trip", back.status, back.status!==200 ? back.text : "");
  const p = ex.projects[0]; const bs = (await admin.get("/api/bootstrap")).body.db;
  console.log("sample project", p.id, p.name, "budget", p.budget);
});
