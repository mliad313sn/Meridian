/**
 * Turn PostgreSQL constraint violations into answers a person can act on.
 *
 * The database is the last line of integrity checking and it is right to
 * refuse bad data — but "Something went wrong on the server" tells the
 * user nothing and tells the on-call engineer nothing either. A rejected
 * write is a 400 or a 409 with the name of the rule that rejected it.
 */

const CONSTRAINT_MESSAGES = {
  project_dates_ordered: "A project cannot finish before it starts",
  project_budget_positive: "Budget and contingency cannot be negative",
  project_contingency_bounded: "That would draw more contingency than the project holds",
  activity_dates_ordered: "A stage cannot end before it starts",
  allocation_dates_ordered: "An allocation cannot end before it starts",
  dep_not_self: "A stage cannot depend on itself",
  cross_dep_not_self: "A project cannot depend on itself",
  grant_target_exclusive: "A grant names one programme, one site or one project, never two",
  /* D-36.12 (058) — a review grant names a programme or a project. */
  grant_review_scope: "A review grant names a programme or a project; a write grant names a programme or a site",
  access_grant_power_known: "A grant carries the write power or the review power",
  series_scope_exclusive: "A meeting series names one scope: group, a programme, or a site",
  cost_period_shape: "A reporting period must be written as YYYY-MM",
  app_user_email_lower_idx: "That email address is already in use",
  access_grant_uniq: "That grant is already held",
  /* REQ-37 — le refus qui ne disait rien. « That record already exists »
     laissait croire à un doublon accidentel ; ce qui est refusé est une
     seconde vague sur le même site, et la phrase doit dire ce qu'est une
     vague et où consigner des phases. Voir la migration 044. */
  rollout_wave_one_per_site:
    "This project already has a rollout wave at that site — a wave IS a site in this rollout, "
    + "and seq is the order the sites go live in, not a phase number within one site. "
    + "Record phases at a single site as milestones on the project.",
};

/** Which table a foreign key points at, in words. */
const FK_TARGETS = {
  programme_id: "programme",
  site_id: "site",
  pm_id: "person",
  owner_id: "person",
  person_id: "person",
  assignee_id: "person",
  project_id: "project",
  activity_id: "stage",
  predecessor_id: "stage",
  cr_id: "change request",
  column_id: "board column",
  user_id: "user account",
  series_id: "meeting series",
  occurrence_id: "meeting",
};

/**
 * @returns {{status:number, message:string}|null} null when the error is
 *          not a constraint violation and should be treated as a fault.
 */
export function translate(err) {
  const code = err?.code;
  if (!code) return null;

  switch (code) {
    case "23502": { // not_null_violation
      return { status: 400, message: `${err.column ?? "A required field"} is required` };
    }
    case "23503": { // foreign_key_violation
      const col = /Key \((\w+)\)/.exec(err.detail ?? "")?.[1];
      const what = FK_TARGETS[col] ?? "record";
      return { status: 400, message: `No such ${what}` };
    }
    case "23505": { // unique_violation
      const named = CONSTRAINT_MESSAGES[err.constraint];
      return { status: 409, message: named ?? "That record already exists" };
    }
    case "23514": { // check_violation
      const named = CONSTRAINT_MESSAGES[err.constraint];
      return { status: 400, message: named ?? "That value is outside what this field allows" };
    }
    case "22P02": // invalid_text_representation
    case "22007": // invalid_datetime_format
    case "22008": // datetime_field_overflow
      return { status: 400, message: "One of those values is not in a form the system can read" };
    case "22003": // numeric_value_out_of_range
      return { status: 400, message: "That number is too large for this field" };
    /* NEW-04 — raise_exception from a trigger. Only the rules this
       product writes are translated, by the sentence they open with;
       anything else raised in PL/pgSQL is still a fault. The
       segregation-of-duties guard (052, 055) says in full which seat
       clashes with which, so its own words are the answer: a conflict
       with a fact already on the record. 400, not 409: the client reads a
       409 as "someone saved first — reload", which would replace this
       sentence in the dialog with a stale-version story (found in the
       browser walk). It is the same class of refusal as a CHECK. */
    case "P0001": {
      const text = String(err.message ?? "");
      if (/^Segregation of duties:/.test(text)) {
        return { status: 400, message: text +
          " — give one of the two seats to someone else, or remove the incompatibility if it was declared in error" };
      }
      return null;
    }
    case "40001": // serialization_failure
    case "40P01": // deadlock_detected
      return { status: 409, message: "That change collided with another — try again" };
    default:
      return null;
  }
}
