/**
 * REQ-48 (RT365) · THE DEMONSTRATION BOOK SAYS WHAT IT IS WORTH
 *
 * « The demonstration book carries no business case, so four of the value
 *   page's six figures read as absences on a fresh install. »
 *
 * Two halves, and both are the line:
 *
 *   1. a fresh seed shows all six value-page figures MEASURED, and the
 *      ranking shows both an order and the not-placed worklist;
 *   2. a book reset for production (reset-book.js) still shows six
 *      honest absences — state N, each with its reason — because the
 *      value came from demonstration rows and must leave with them.
 *
 * The second half is what stops the first from being cosmetic: a seed
 * that made the page look full by any means other than rows the reset
 * removes would survive into production as a fabricated figure.
 */

import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { boot, shutdown, as } from "./harness.js";
import { many } from "../src/db.js";
import { resetBook } from "../src/reset-book.js";
import { loadPortfolio } from "../src/portfolio.js";
import { valuePage, FIGURE_ORDER } from "../../shared/valuepage.js";

const ADMIN = {
  id: "U-ADMIN", role: "admin", active: true,
  grants: { programmes: new Set(), sites: new Set() },
};

describe("REQ-48 · the seeded book and the reset book", () => {
  before(async () => { await boot(); });
  after(shutdown);

  test("a fresh seed shows the six figures of the value page measured", async () => {
    const admin = await as("admin");
    const r = await admin.get("/api/valuepage");
    assert.equal(r.status, 200, r.text);
    const notMeasured = FIGURE_ORDER.filter((k) => r.body.figures[k].state !== "measured");
    assert.deepEqual(notMeasured, [], "every figure has something to measure on day one");
    assert.equal(r.body.scope.measured, 6);
    for (const k of FIGURE_ORDER) {
      assert.equal(r.body.figures[k].why, null, `${k} is measured, so it carries no reason for silence`);
    }
  });

  test("the seed's value is uneven on purpose: cases and no cases, a late review, a constated exception", async () => {
    const admin = await as("admin");
    const page = (await admin.get("/api/valuepage")).body;
    const f = page.figures;
    assert.ok(f.spendAgainstCase.extra.uncased > 0, "some projects carry no case");
    assert.ok(f.spendAgainstCase.extra.cased > 0, "and some do");
    assert.ok(f.overdueReviews.value >= 1, "a benefit is past its date and unmeasured");
    assert.ok(f.exceptionsOpen.value >= 1, "at least one exception is open");
    /* The exceptions were raised by the sweep, not typed by the seed:
       the trail says so, and each one has its two numbers. */
    const raised = await many(
      `SELECT entity_id FROM audit_event WHERE action = 'Exception raised'`);
    const open = await many(`SELECT id FROM project_exception WHERE status = 'Open'`);
    assert.deepEqual(open.map((x) => x.id).sort(), raised.map((x) => x.entity_id).sort(),
      "every open exception of the seed was constated by the sweep");

    const rank = (await admin.get("/api/prioritisation")).body;
    assert.ok(rank.counts.ranked > 0, "the ranking places some projects");
    assert.ok(rank.counts.notPlaced > 0, "and lists the rest as not placed, each with why");
  });

  test("after resetBook the six are absences, each with its reason — never a zero", async () => {
    await resetBook();
    const db = await loadPortfolio(ADMIN);
    const page = valuePage(db);
    for (const k of FIGURE_ORDER) {
      const f = page.figures[k];
      assert.equal(f.state, "N", `${k} is not measured on an empty production book`);
      assert.equal(f.value, null, `${k} carries no invented number`);
      assert.ok(f.why, `${k} says why it is silent`);
    }
    assert.equal(page.scope.notMeasured, 6);
  });
});
