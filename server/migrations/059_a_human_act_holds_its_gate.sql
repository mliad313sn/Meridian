-- ═══════════════════════════════════════════════════════════════════
-- 059 · A STANDING HUMAN ACT HOLDS THE GATE IT BLOCKS
--        (REQ-13, second half · D-33.14 · D-36.15)
--
-- RT365 keeps a table of standing human acts, H-nn: an action only a
-- named person can take (sign, provision, approve), the gate it blocks,
-- and the evidence that says it was done. Its rule is one line: "an
-- action stays here until its evidence file exists". D-33.14 said such an
-- act is a RAID Dependency with category "Human act", an owner and a
-- review date; D-36.15 finishes the sentence. While one is open, the gate
-- it blocks does not clear, as an open veto holds a gate (MER-06), and
-- the refusal names the act and its owner.
--
-- Two columns, and no new register: RT365 already syncs these as RAID
-- rows, and a second register would split one queue in two.
--
-- ── blocks_gate ──────────────────────────────────────────────────────
-- Not every row linked to a gate blocks it. I-8 (034) linked risks to
-- gates to be READ, and said so: informative, never blocking. That stays
-- true of every existing row, because the flag defaults to false and
-- nothing here sets it. A blocking row is a Dependency on a project's
-- gate; a portfolio-wide row has no gate to hold.
--
-- ── closure_evidence ─────────────────────────────────────────────────
-- A locator a reader can find again, validated by the same rule as a
-- decision's evidence (server/src/evidence.js). A blocking act does not
-- close without it: that is the rule RT365 wrote, and the database holds
-- it as well as the route, so no path of the product (screen, contract,
-- import) can close one on a word. Reopening clears it, like closed_on.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE raid_item ADD COLUMN blocks_gate boolean NOT NULL DEFAULT false;
ALTER TABLE raid_item ADD COLUMN closure_evidence text NOT NULL DEFAULT '';

ALTER TABLE raid_item ADD CONSTRAINT raid_blocking_act_shape
  CHECK (NOT blocks_gate OR (kind = 'Dependency' AND gate IS NOT NULL AND project_id IS NOT NULL));
ALTER TABLE raid_item ADD CONSTRAINT raid_blocking_act_closed_on_evidence
  CHECK (NOT blocks_gate OR status <> 'Closed' OR closure_evidence <> '');

CREATE INDEX raid_blocking_idx ON raid_item(project_id, gate)
  WHERE blocks_gate AND status = 'Open';
