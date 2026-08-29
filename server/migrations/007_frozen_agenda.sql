-- ═══════════════════════════════════════════════════════════════════
-- 007 · THE FROZEN AGENDA, FAITHFULLY
--
-- Closing a meeting freezes its agenda (R5.2/R5.8), but the freeze was
-- lossy in two ways the code review found:
--
--   · only the section TITLE was stored, and the reader handed that back
--     as the section key — so a section keyed "actions" while live came
--     back keyed "Actions carried forward" once closed, and any client
--     branching on the key (the referral picker does) stopped matching;
--   · `urgent` was never stored, so the minutes of a closed meeting lost
--     every bold line — the overdue action, the RED project and the
--     referral read exactly like everything else, which is the opposite
--     of what a frozen record is for.
--
-- Both are one column each. Existing rows keep the old behaviour: the
-- reader falls back to the title when section_key is null.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE agenda_item ADD COLUMN section_key text;
ALTER TABLE agenda_item ADD COLUMN urgent boolean NOT NULL DEFAULT false;
