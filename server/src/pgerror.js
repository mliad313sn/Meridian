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
  grant_target_exclusive: "A grant names either a programme or a site, never both",
  series_scope_exclusive: "A meeting series names one scope: group, a programme, or a site",
  cost_period_shape: "A reporting period must be written as YYYY-MM",
  app_user_email_lower_idx: "That email address is already in use",
  access_grant_uniq: "That grant is already held",
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
    case "40001": // serialization_failure
    case "40P01": // deadlock_detected
      return { status: 409, message: "That change collided with another — try again" };
    default:
      return null;
  }
}
