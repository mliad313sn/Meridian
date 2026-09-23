/**
 * The client's copy of the authority rules.
 *
 * Not a copy at all, in fact: it is the same module the server enforces
 * with (AD-2). Sharing the file removes the failure mode where the two
 * drift and the interface offers a button the server will refuse — while
 * changing nothing about where authority is actually decided, which is
 * still server-side, on every request.
 *
 * The only adaptation is shape: the server carries grants as Sets, the
 * bootstrap response carries them as arrays.
 */

import {
  can as rawCan, canWriteProject as rawWrite, canSeeProject as rawSee,
  canWriteScope as rawScope, ACTIONS, ROLES,
} from "../../../shared/rbac.js";

function adapt(me) {
  if (!me) return null;
  return {
    id: me.id,
    role: me.role,
    active: me.active !== false,
    /* NEW-04 — who is at the keyboard, as rbac's `selfMatch` reads it.
       Dropped here until now, so every independence rule (the objector
       rewording their own objection, the decider never answering one)
       was decided in the browser as if nobody were signed in, and the
       screen drew what the server then refused. */
    personId: me.personId ?? null,
    actingForPersonId: me.actingForPersonId ?? null,
    grants: {
      programmes: new Set(me.grants?.programmes ?? []),
      sites: new Set(me.grants?.sites ?? []),
      /* D-36.12 — the review grants, kept apart from the write grants
         exactly as the server keeps them, so the screen draws Approve for
         a reviewer and nothing else. */
      reviews: {
        programmes: new Set(me.grants?.reviews?.programmes ?? []),
        projects: new Set(me.grants?.reviews?.projects ?? []),
      },
    },
  };
}

export const can = (me, action, resource) => rawCan(adapt(me), action, resource);
export const canWriteProject = (me, project) => rawWrite(adapt(me), project);
export const canSeeProject = (me, project) => rawSee(adapt(me), project);
export const canWriteScope = (me, scope) => rawScope(adapt(me), scope);
export { ACTIONS, ROLES };
