/**
 * UI KIT — the DOM builder and the handful of parts every view is
 * assembled from. Lifted verbatim from the v4 build (D-08).
 *
 * `h()` builds text nodes by default, so data from the server cannot
 * become markup by accident. The one `html:` escape hatch is used only
 * with literals in this file, and F-13 flagged it as a footgun now that
 * data arrives over a wire — so it is removed here rather than kept.
 */

import { Engine, D, iso, days, fmtDate, fmtMon, monthKey, money, cash, pct, idx, sum, clamp, by }
  from "../../../shared/engine.js";
import { App } from "../lib/state.js";
import { t, tData } from "../lib/i18n.js";

/* Two helpers the single-file build kept in its utilities block. */
const initials = (name) =>
  String(name || "?").split(/[s.]+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

const SVGNS = "http://www.w3.org/2000/svg";

/** Build a DOM element. Children are appended as text (safe) or nodes. */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  apply(el, props);
  add(el, kids);
  return el;
}
/** Same, in the SVG namespace. */
function s(tag, props, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  apply(el, props, true);
  add(el, kids);
  return el;
}
/**
 * S-01 — a URL attribute holds a location, never code.
 *
 * `javascript:` and `data:` in an href are script that runs on click, in
 * this origin, as the person who clicked. The application stores links
 * people type (a document's artefact), so the rule lives HERE rather than
 * in each caller: one place decides what may become an href, the same way
 * one place decides authority. Relative and same-document links stay
 * legal; anything with a scheme must be http or https.
 */
const URL_ATTR = new Set(["href", "src", "action", "formaction", "xlink:href", "poster"]);
export function safeHref(v) {
  const s = String(v ?? "").trim();
  if (!s) return false;
  // eslint-disable-next-line no-control-regex
  const scheme = s.replace(/[\u0000-\u0020]/g, "").match(/^([a-z][a-z0-9+.-]*):/i);
  if (!scheme) return true;                       // relative, #fragment, ?query
  return /^https?$/i.test(scheme[1]);
}
function apply(el, props, isSvg) {
  if (!props) return;
  for (const k in props) {
    const v = props[k];
    if (v === null || v === undefined || v === false) continue;
    if (URL_ATTR.has(k.toLowerCase()) && !safeHref(v)) continue;
    if (k === "class" || k === "className") {
      if (isSvg) el.setAttribute("class", v); else el.className = v;
    } else if (k === "style") {
      if (typeof v === "string") el.setAttribute("style", v);
      else for (const p in v) el.style.setProperty(p, v[p]);
    } else if (k === "text") {
      el.textContent = v;
    } else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "value" && !isSvg && ("value" in el)) {
      el.value = v;
    } else if (k === "checked" || k === "disabled" || k === "selected") {
      if (v) el.setAttribute(k, ""); else el.removeAttribute(k);
      if (k in el) el[k] = !!v;
    } else if (k === "data") {
      for (const p in v) el.dataset[p] = v[p];
    } else {
      el.setAttribute(k, v);
    }
  }
}
function add(el, kids) {
  for (const kid of kids) {
    if (kid === null || kid === undefined || kid === false || kid === true) continue;
    if (Array.isArray(kid)) add(el, kid);
    else if (kid instanceof Node) el.appendChild(kid);
    else el.appendChild(document.createTextNode(String(kid)));
  }
}
const frag = (...kids) => { const f = document.createDocumentFragment(); add(f, kids); return f; };
const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
const $ = (sel, root) => (root || document).querySelector(sel);

/* ── icons (Lucide paths, drawn inline) ───────────────────────────── */
const ICON = {
  search: "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.3-4.3",
  plus: "M12 5v14M5 12h14",
  x: "M18 6 6 18M6 6l12 12",
  chevronRight: "M9 18l6-6-6-6",
  chevronDown: "M6 9l6 6 6-6",
  check: "M20 6 9 17l-5-5",
  alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  menu: "M3 12h18M3 6h18M3 18h18",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  pencil: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  arrowRight: "M5 12h14M12 5l7 7-7 7",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  printer: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
  filter: "M22 3H2l8 9.5V19l4 2v-8.5z",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};
function icon(name, size = 14, stroke = 2) {
  /* An unknown name used to throw inside the render, which the view's
     catch turned into "this view could not be drawn" — a whole screen
     lost to a typo in an icon name. A missing glyph is not worth a page. */
  if (!ICON[name]) return null;
  return s("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", "stroke-width": stroke, "stroke-linecap": "square",
    "stroke-linejoin": "miter", "aria-hidden": "true", style: "flex:none" },
    ...ICON[name].split("M").filter(Boolean).map(d => s("path", { d: "M" + d })));
}

/* ── dates ────────────────────────────────────────────────────────── */
const DAY = 86400000;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

let openDialogs = 0;
/**
 * `dismissible: false` removes every casual way out — the corner X, the
 * backdrop click and Escape — leaving only the buttons the caller wires.
 * A dialog that states a condition of using the app (change this
 * password) is not a dialog you leave by pressing Escape.
 */
function dialog({ title, kicker, body, actions, wide, onClose, dismissible = true }) {
  const host = $("#overlay");
  const back = h("div", { class: "backdrop", role: "dialog", "aria-modal": "true", "aria-label": title });
  /* R-04 — aria-modal was a promise the page did not keep: 65 focusable
     elements stayed reachable behind the box. The application root is
     made INERT while any dialog is open (so assistive tech cannot reach
     behind either), Tab is trapped inside the box, and the focus is
     handed back to whatever opened the dialog when it closes. */
  const opener = document.activeElement;
  const appRoot = document.getElementById("root");
  /* The shell suppresses re-renders while a dialog is open, so that a
     save does not rearrange the form under the hands typing into it. The
     counter therefore owes an announcement when it reaches zero: a
     formDialog awaits its save BEFORE closing, so the refresh that write
     triggered was skipped, and without this the screen still shows the
     book as it was before the thing the user just saved. */
  /* The focus goes home — but closing usually triggers a re-render that
     REBUILDS the page, destroying the exact element that opened us. So
     the opener's signature is kept, and after the re-render its twin in
     the fresh DOM is focused instead. A keyboard user who loses their
     place on every save re-navigates the page from the top each time. */
  const openerSig = opener && opener.tagName === "BUTTON"
    ? { text: opener.textContent.trim(), label: opener.getAttribute("aria-label"), title: opener.getAttribute("title") }
    : null;
  const refocus = () => {
    if (opener && opener.isConnected) { opener.focus(); return; }
    if (!openerSig) return;
    const twin = [...document.querySelectorAll("button")].find((b) =>
      (openerSig.text && b.textContent.trim() === openerSig.text) ||
      (openerSig.label && b.getAttribute("aria-label") === openerSig.label) ||
      (openerSig.title && b.getAttribute("title") === openerSig.title));
    if (twin) twin.focus();
  };
  const close = () => {
    back.remove();
    openDialogs--;
    if (openDialogs === 0 && appRoot) appRoot.inert = false;
    if (onClose) onClose();
    if (openDialogs === 0) App.emit();
    setTimeout(refocus, 0);
  };
  if (dismissible) back.addEventListener("mousedown", e => { if (e.target === back) close(); });
  const box = h("div", { class: "dialog" + (wide ? " wide" : "") },
    h("div", { class: "dialog-hd" },
      h("div", { class: "sp" },
        kicker ? h("div", { class: "kicker" }, kicker) : null,
        h("h4", { style: "margin-top:3px" }, title)),
      dismissible
        ? h("button", { class: "btn btn-ghost", "aria-label": "Close", onClick: close }, icon("x", 15))
        : null),
    h("div", { class: "dialog-bd" }, typeof body === "function" ? body(close) : body),
    actions ? h("div", { class: "dialog-ft" }, h("div", { class: "sp" }), ...actions(close)) : null);
  back.appendChild(box);
  host.appendChild(back);
  openDialogs++;
  if (appRoot) appRoot.inert = true;
  const first = box.querySelector("input,select,textarea,button.btn-primary");
  if (first) setTimeout(() => first.focus(), 30);
  back.addEventListener("keydown", e => {
    if (e.key === "Escape" && dismissible) { e.stopPropagation(); close(); return; }
    if (e.key !== "Tab") return;
    /* The trap: Tab cycles inside the box, in both directions. Recomputed
       per keypress — the form may have grown a note or a button since. */
    const focusables = [...box.querySelectorAll(
      "input,select,textarea,button,a[href],[tabindex]:not([tabindex='-1'])"
    )].filter(el => !el.disabled && el.offsetParent !== null);
    if (!focusables.length) return;
    const firstEl = focusables[0], lastEl = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === firstEl || !box.contains(document.activeElement))) {
      e.preventDefault(); lastEl.focus();
    } else if (!e.shiftKey && (document.activeElement === lastEl || !box.contains(document.activeElement))) {
      e.preventDefault(); firstEl.focus();
    }
  });
  return close;
}

function confirmDialog({ title, message, confirmLabel = "Confirm", danger, detail }) {
  return new Promise(resolve => {
    let settled = false;
    const done = (v) => { if (settled) return; settled = true; resolve(v); };
    const close = dialog({
      title, kicker: "Confirm",
      body: h("div", null,
        h("p", { style: "margin:0 0 8px" }, message),
        detail ? h("div", { class: "small muted" }, detail) : null),
      actions: (c) => [
        h("button", { class: "btn", onClick: () => { done(false); c(); } }, "Cancel"),
        h("button", { class: "btn " + (danger ? "btn-danger" : "btn-primary"), onClick: () => { done(true); c(); } }, confirmLabel),
      ],
      onClose: () => done(false),
    });
    return close;
  });
}

/* ── forms ────────────────────────────────────────────────────────── */
/**
 * Build a form from a field spec. Returns { el, read(), validate() }.
 * Field: { key, label, type, options, required, hint, span, min, max, step, rows }
 */
function form(fields, initial = {}) {
  const state = { ...initial };
  const nodes = {};
  const errs = {};

  /* Longstanding latent defect, caught by the retest loop: a field's
     prefilled `value:` was RENDERED but never seeded into the state, so
     an edit dialog whose fields were all visibly filled answered
     "Required" on save unless every required field was retyped. The
     state now starts from what the form shows — which is what read()
     and validate() were always assumed to see. */
  for (const f of fields) {
    if (state[f.key] === undefined && f.value !== undefined) state[f.key] = f.value;
  }

  /* R-07 — the short path is the default. Fields marked `advanced: true`
     fold behind one "More detail" toggle: still saved, still validated,
     never demanded of someone filling this in standing up on a site
     visit. A field that already carries a value opens unfolded — hiding
     what somebody typed reads as losing it. */
  const carries = (v) => v !== undefined && v !== "" && v !== null;
  const isAdvanced = (f) => f.advanced === true &&
    !(f.type !== "select" && f.type !== "checkbox" && (carries(state[f.key]) || carries(f.value)));
  const basic = fields.filter(f => !isAdvanced(f));
  const advanced = fields.filter(isAdvanced);

  const renderField = (f) => {
    const id = "f_" + f.key + "_" + Math.random().toString(36).slice(2, 6);
    let input;
    const val = state[f.key] ?? f.value ?? (f.type === "checkbox" ? false : "");
    const commit = (v) => { state[f.key] = v; if (f.onChange) f.onChange(v, state); };

    if (f.type === "select") {
      input = h("select", { class: "input", id, onChange: e => commit(e.target.value) },
        ...(f.options || []).map(o => {
          const value = typeof o === "string" ? o : o.value;
          const label = typeof o === "string" ? o : o.label;
          return h("option", { value, selected: String(value) === String(val) }, label);
        }));
      input.value = val;
    } else if (f.type === "textarea") {
      input = h("textarea", { class: "input", id, rows: f.rows || 3, value: val, onInput: e => commit(e.target.value) });
    } else if (f.type === "checkbox") {
      const wrap = h("label", { class: "checkline", for: id });
      const box = h("span", { class: "check" + (val ? " on" : "") });
      input = h("input", { type: "checkbox", id, checked: !!val, style: "position:absolute;opacity:0;width:0;height:0",
        onChange: e => { commit(e.target.checked); box.className = "check" + (e.target.checked ? " on" : ""); } });
      add(wrap, [input, box, h("span", null, h("span", { class: "strong" }, f.label), f.hint ? h("div", { class: "small muted" }, f.hint) : null)]);
      nodes[f.key] = input;
      return h("div", { class: f.span === 2 ? "full" : "" }, wrap);
    } else {
      input = h("input", { class: "input", id, type: f.type || "text", value: val,
        min: f.min, max: f.max, step: f.step, placeholder: f.placeholder,
        onInput: e => commit(f.type === "number" ? (e.target.value === "" ? "" : +e.target.value) : e.target.value) });
    }
    nodes[f.key] = input;
    const errEl = h("div", { class: "err", style: "display:none" });
    errs[f.key] = errEl;
    return h("div", { class: "field " + (f.span === 2 ? "full" : "") },
      h("label", { for: id }, f.label + (f.required ? " *" : "")),
      input,
      f.hint ? h("div", { class: "small muted" }, f.hint) : null,
      errEl);
  };

  const el = h("div", null, h("div", { class: "form-grid" }, ...basic.map(renderField)));
  if (advanced.length) {
    const more = h("div", { class: "form-grid", style: "display:none;margin-top:12px" },
      ...advanced.map(renderField));
    const toggle = h("button", {
      class: "btn btn-xs btn-ghost", type: "button", "aria-expanded": "false",
      style: "margin-top:10px",
      onClick: () => {
        const open = more.style.display === "none";
        more.style.display = open ? "" : "none";
        toggle.setAttribute("aria-expanded", String(open));
        toggle.textContent = open ? t("Less detail") : t("More detail") + " (" + advanced.length + ")";
      },
    }, t("More detail") + " (" + advanced.length + ")");
    el.append(toggle, more);
  }

  function validate() {
    let ok = true;
    fields.forEach(f => {
      const v = state[f.key];
      let msg = "";
      if (f.required && (v === "" || v === null || v === undefined)) msg = "Required";
      else if (f.type === "number" && v !== "" && f.min !== undefined && v < f.min) msg = "Minimum " + f.min;
      else if (f.type === "number" && v !== "" && f.max !== undefined && v > f.max) msg = "Maximum " + f.max;
      else if (f.validate) msg = f.validate(v, state) || "";
      if (errs[f.key]) {
        errs[f.key].textContent = msg;
        errs[f.key].style.display = msg ? "block" : "none";
      }
      if (nodes[f.key]) nodes[f.key].classList.toggle("invalid", !!msg);
      if (msg) ok = false;
      /* A refusal must never point at a field the fold is hiding. */
      if (msg && advanced.some((a) => a.key === f.key)) {
        const hidden = el.querySelector(".form-grid[style*='none']");
        if (hidden) hidden.style.display = "";
      }
    });
    return ok;
  }
  return { el, read: () => ({ ...state }), validate, nodes };
}

/** Convenience: a dialog wrapping a form with Save / Cancel. */
function formDialog({ title, kicker, fields, initial, saveLabel = "Save", onSave, wide, extra,
                      dismissible = true, cancelLabel = "Cancel", onCancel }) {
  const f = form(fields, initial);
  /* The failure conversation happens HERE, with the user's typed input
     kept alive (UX committee): the old flow closed optimistically —
     onSave returns a Promise, a Promise is never `false`, so a 409 threw
     away a re-baseline justification the user had just written. */
  const note = h("div", {
    class: "small", role: "alert",
    style: "display:none;margin-top:12px;padding:9px 12px;border:1px solid var(--sig-red);border-radius:6px;color:var(--sig-red)",
  });
  const close = dialog({
    title, kicker, wide, dismissible,
    body: h("div", null, f.el, extra ? h("div", { style: "margin-top:16px" }, extra) : null, note),
    actions: (c) => [
      h("button", { class: "btn", onClick: () => (onCancel ? onCancel() : c()) }, t(cancelLabel)),
      h("button", { class: "btn btn-primary", onClick: async (ev) => {
        if (!f.validate()) return;
        const btn = ev.currentTarget;
        const label = btn.textContent;
        btn.disabled = true;
        btn.textContent = t("Saving…");
        let result;
        /* Cleared first, or the note below explains this failure with the
           last one's words — including a stale-version story about a save
           that never reached the server. */
        App.lastWriteError = null;
        try { result = await onSave(f.read()); }
        catch (e) { App.lastWriteError = App.lastWriteError ?? e; result = false; }
        btn.disabled = false;
        btn.textContent = label;
        if (result !== false) { c(); return; }
        const err = App.lastWriteError;
        const stale = !!(err && err.isStale);
        note.textContent = stale
          ? "Someone saved a newer version while you were typing. The book has been reloaded underneath — " +
            "your entries are kept here; press " + label + " again to reapply them, or Cancel to review first."
          : ((err && err.message ? err.message : t("That change was not saved.")) +
             t(" Your entries are kept — fix and try again, or Cancel."));
        note.style.display = "";
      } }, t(saveLabel)),
    ],
  });
  /* Enter in a single-line field saves (UX committee): a form you can
     only submit with the mouse is a form that gets abandoned. */
  f.el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const field = e.target;
    if (!field || field.tagName !== "INPUT" || field.type === "checkbox") return;
    e.preventDefault();
    /* THIS dialog's Save. A document-wide query returns the first
       backdrop in the document, which with a dialog opened over another
       one is the dialog underneath — Enter would save the wrong form. */
    const save = f.el.closest(".backdrop")?.querySelector(".btn-primary");
    if (save && !save.disabled) save.click();
  });
  return close;
}

/* ── tables ───────────────────────────────────────────────────────── */
/**
 * cols: [{ key, label, get(row)->node|string, sort(row)->comparable, align, width, th }]
 */
function table({ cols, rows, onRow, selected, empty, sortKey, sortDir, onSort, footer, rowClass }) {
  const thead = h("thead", null, h("tr", null, ...cols.map(c =>
    h("th", {
      class: (c.align === "r" ? "r " : c.align === "c" ? "c " : "") + (c.sort && onSort ? "sortable" : ""),
      style: c.width ? "width:" + c.width : null,
      onClick: c.sort && onSort ? () => onSort(c.key) : null,
      title: c.sort && onSort ? "Sort by " + c.label : null,
    }, c.label, c.sort && onSort && sortKey === c.key ? h("span", { class: "car" }, sortDir > 0 ? "▲" : "▼") : null))));

  const body = h("tbody", null, ...rows.map(r =>
    h("tr", {
      class: (onRow ? "click " : "") + (selected && selected(r) ? "sel " : "") + (rowClass ? rowClass(r) : ""),
      onClick: onRow ? (e) => { if (e.target.closest("button,a,input,select")) return; onRow(r); } : null,
      tabindex: onRow ? 0 : null,
      onKeydown: onRow ? (e) => { if (e.key === "Enter") onRow(r); } : null,
    }, ...cols.map(c => h("td", { class: c.align === "r" ? "r" : c.align === "c" ? "c" : "" }, c.get(r))))));

  if (!rows.length) {
    body.appendChild(h("tr", null, h("td", { colspan: cols.length },
      h("div", { class: "empty" },
        h("strong", null, (empty && empty.title) || "Nothing here yet"),
        (empty && empty.body) || "Adjust the filters, or add the first record."))));
  }
  return h("div", { class: "tbl-wrap" },
    h("table", { class: "table" }, thead, body, footer ? h("tfoot", null, footer) : null));
}

function sortRows(rows, cols, key, dir) {
  const col = cols.find(c => c.key === key);
  if (!col || !col.sort) return rows;
  return rows.slice().sort((a, b) => {
    const x = col.sort(a), y = col.sort(b);
    if (x === y) return 0;
    return (x > y ? 1 : -1) * dir;
  });
}

/** Wire a sortable table to the shared ui.sort state. */
function sortableTable(opts) {
  const { key, dir } = App.ui.sort;
  const rows = sortRows(opts.rows, opts.cols, key, dir);
  return table({
    ...opts, rows, sortKey: key, sortDir: dir,
    onSort: (k) => App.set({ sort: { key: k, dir: k === key ? -dir : 1 } }),
  });
}

/* ── small pieces ─────────────────────────────────────────────────── */
const RAG_LABEL = { G: "GREEN", A: "AMBER", R: "RED" };
/* Status is drawn twice over: hue and word. Roughly one man in twelve
   cannot separate the first, so the label is not decoration. */
const SIGNAL = { R: "var(--sig-red)", A: "var(--sig-amber)", G: "var(--sig-green)" };
function ragDot(rag, withLabel) {
  return h("span", {
    style: "display:inline-flex;align-items:center;gap:6px;font-family:var(--font-mono);" +
           "font-size:10px;font-weight:500;letter-spacing:.02em;white-space:nowrap;color:" +
           (SIGNAL[rag] || "var(--muted)"),
  },
    h("span", { class: "dot", style: { background: SIGNAL[rag] || "var(--color-neutral-400)" } }),
    withLabel === false ? null : (RAG_LABEL[rag] || "—"));
}
function meter(fraction, color, height) {
  return h("div", { class: "meter" + (height === "thin" ? " thin" : "") },
    h("i", { style: { width: clamp(fraction, 0, 1) * 100 + "%", background: color || "var(--color-text)" } }));
}
function kpiStrip(items) {
  /* auto-fit rather than a fixed count: six readouts in a narrow main are
     unreadable, and wrapping to two rows is what a real instrument does.
     R-15 — labels and notes translate HERE, once, so a tile can never be
     half-French again: the label through the dictionary, the note through
     the fragment translator, because notes carry live numbers. */
  return h("div", { class: "kpis", style: { "grid-template-columns": "repeat(auto-fit,minmax(148px,1fr))" } },
    ...items.map(k => h("div", { class: "kpi" },
      h("div", { class: "kicker" }, typeof k.label === "string" ? t(k.label) : k.label),
      h("div", { class: "kpi-v", style: k.accent ? "color:var(--sig-red)" : null }, k.value),
      h("div", { class: "kpi-n" }, typeof k.note === "string" ? tData(k.note) : k.note))));
}
function sectionHead(title, note, ...actions) {
  return h("div", { class: "sec-hd" },
    h("h4", null, typeof title === "string" ? t(title) : title),
    note ? h("span", { class: "small muted" }, typeof note === "string" ? tData(note) : note) : null,
    h("span", { class: "sp" }),
    ...actions.filter(Boolean));
}
/* R-07 — what is read weekly stays open; what is read quarterly folds.
   Nothing is removed, and the summary line says what is inside so the
   fold is a table of contents, not a hiding place. */
function fold(title, sub, openByDefault, ...content) {
  const d = h("details", { class: "fold" }, h("summary", { class: "fold-hd" },
    h("span", { class: "strong small" }, typeof title === "string" ? t(title) : title),
    sub ? h("span", { class: "xs muted", style: "margin-left:10px" },
      typeof sub === "string" ? tData(sub) : sub) : null));
  if (openByDefault) d.open = true;
  add(d, [h("div", { style: "padding-top:8px" }, ...content)]);
  return d;
}

function tag(text, kind) { return h("span", { class: "tag " + (kind || "") }, text); }
function chip(label, on, onClick) { return h("button", { class: "chip" + (on ? " on" : ""), onClick }, label); }
function statusTag(status) {
  const map = { Approved: "tag-ink", Cleared: "tag-ink", Closed: "tag-ink", "In review": "tag-soft",
    "At risk": "tag-accent", Overdue: "tag-accent", Pending: "tag-accent", Rejected: "tag-out",
    Draft: "tag-out", Planned: "tag-out", Ready: "tag-soft", Open: "tag-soft" };
  /* R-15 — the WORD is translated, the VALUE compared upstream stays
     English: display and comparison never share a string. */
  return tag(t(status), map[status] || "");
}
function avatar(db, personId, size) {
  const p = Engine.person(db, personId);
  return h("span", { class: "avatar" + (size === "sm" ? " sm" : ""), title: p ? p.name + " · " + p.role : "Unassigned" },
    p ? initials(p.name) : "—");
}
function searchBox(value, placeholder, onInput) {
  const input = h("input", { value, placeholder, "aria-label": placeholder, onInput: debounce(e => onInput(e.target.value), 220) });
  return h("div", { class: "search", style: "min-width:180px" }, icon("search", 13), input);
}
function selectField(label, value, options, onChange, width) {
  return h("div", { class: "field", style: width ? "width:" + width : "min-width:150px" },
    h("label", null, label),
    h("select", { class: "input", onChange: e => onChange(e.target.value), value },
      ...options.map(o => {
        const v = typeof o === "string" ? o : o.value, l = typeof o === "string" ? o : o.label;
        return h("option", { value: v, selected: String(v) === String(value) }, l);
      })));
}
function emptyState(title, body, action) {
  return h("div", { class: "drop-hint", style: "margin:6px 0" },
    h("div", { class: "strong", style: "font-family:var(--font-heading);font-size:14px;color:var(--color-text)" }, title),
    h("div", { style: "margin:4px 0 10px" }, body),
    action || null);
}

/* ── tiny charts ──────────────────────────────────────────────────── */
function sparkline(values, w = 120, hgt = 28, color) {
  if (!values.length) return h("span");
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, hgt - ((v - min) / span) * hgt]);
  return s("svg", { class: "sparkline", width: w, height: hgt, viewBox: `0 0 ${w} ${hgt}` },
    s("polyline", { points: pts.map(p => p.join(",")).join(" "), fill: "none",
      stroke: color || "var(--color-text)", "stroke-width": 2 }));
}

/** Planned / earned / actual money curve. */
function curveChart(series, w = 640, hgt = 190) {
  if (!series.length) return h("div", { class: "small muted" }, "No schedule to plot yet.");
  const pad = { l: 44, r: 8, t: 10, b: 22 };
  const iw = w - pad.l - pad.r, ih = hgt - pad.t - pad.b;
  const maxV = Math.max(...series.map(p => Math.max(p.pv || 0, p.ev || 0, p.ac || 0))) * 1.08 || 1;
  const x = i => pad.l + (i / Math.max(1, series.length - 1)) * iw;
  const y = v => pad.t + ih - (v / maxV) * ih;
  const line = (key, color, dash) => {
    const pts = series.map((p, i) => p[key] === null || p[key] === undefined ? null : [x(i), y(p[key])]).filter(Boolean);
    return pts.length < 2 ? null : s("polyline", { points: pts.map(p => p.join(",")).join(" "), fill: "none",
      stroke: color, "stroke-width": 2, "stroke-dasharray": dash || null });
  };
  const ticks = [0, 0.5, 1].map(f => {
    const v = maxV * f;
    return s("g", null,
      s("line", { x1: pad.l, x2: w - pad.r, y1: y(v), y2: y(v), stroke: "var(--rule-1)", "stroke-width": 1 }),
      s("text", { x: 0, y: y(v) + 4, "font-size": 9, fill: "var(--muted)", "font-family": "IBM Plex Mono" }, "$" + v.toFixed(1) + "M"));
  });
  const labels = series.map((p, i) => (i % Math.ceil(series.length / 7) === 0)
    ? s("text", { x: x(i), y: hgt - 6, "font-size": 9, fill: "var(--muted)", "font-family": "IBM Plex Mono", "text-anchor": "middle" },
        MONTHS[+p.period.slice(5, 7) - 1] + " " + p.period.slice(2, 4))
    : null).filter(Boolean);
  const todayIdx = series.findIndex(p => p.period >= monthKey(App.db.statusDate));
  return s("svg", { width: "100%", height: hgt, viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: "xMidYMid meet", role: "img", "aria-label": "Planned, earned and actual value over time" },
    ...ticks, ...labels,
    todayIdx >= 0 ? s("line", { x1: x(todayIdx), x2: x(todayIdx), y1: pad.t, y2: pad.t + ih, stroke: "var(--color-accent)", "stroke-width": 2, "stroke-dasharray": "3 3" }) : null,
    line("pv", "var(--color-neutral-500)", "4 3"),
    line("ac", "var(--color-accent)"),
    line("ev", "var(--color-text)"));
}

function legend(items) {
  return h("div", { class: "chips", style: "margin-top:8px" }, ...items.map(i =>
    h("span", { class: "small muted", style: "display:inline-flex;align-items:center;gap:6px" },
      h("span", { style: { width: "14px", height: "3px", background: i.color, display: "block" } }), i.label)));
}
/** The shell suppresses re-renders while a dialog is open, so a
    background refresh cannot pull a form out from under someone. */
const openDialogCount = () => openDialogs;

export {
  SVGNS, h, s, frag, clear, $, ICON, icon,
  dialog, confirmDialog, form, formDialog, table, sortRows, sortableTable,
  ragDot, meter, kpiStrip, sectionHead, tag, chip, statusTag, avatar,
  searchBox, selectField, emptyState, sparkline, curveChart, legend,
  openDialogCount, fold,
};
