/**
 * The subset of JSON Schema 2020-12 that docs/requests/register.schema.json
 * actually uses, validated in about a hundred lines.
 *
 * Why not ajv: the register gate runs in `npm run audit`, which every
 * contributor and the release run, and this repository ships four runtime
 * dependencies on purpose. A validator is a place where a supply chain
 * meets a document nobody executes — and the schema is ours, so the subset
 * it needs is closed and known. If a schema ever needs a keyword that is
 * not here, `unsupported()` says so loudly rather than passing silently:
 * a validator that ignores what it does not understand is worse than none.
 *
 *   import { validate } from "../lib/jsonschema.mjs";
 *   const problems = validate(schema, document);   // [] when it conforms
 */

const KNOWN = new Set([
  "$schema", "$id", "$defs", "$ref", "title", "description", "examples", "default",
  "type", "const", "enum", "required", "properties", "additionalProperties",
  "items", "minItems", "minLength", "minimum", "pattern",
  "anyOf", "allOf", "if", "then", "else",
]);

const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array"
  : Number.isInteger(v) ? "integer" : typeof v);

/** integer satisfies "number"; everything else is its own name. */
const isType = (v, t) => (t === "number" ? typeOf(v) === "integer" || typeOf(v) === "number"
  : typeOf(v) === t);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function resolve(ref, root) {
  if (!ref.startsWith("#/")) throw new Error(`only local $ref is supported, not ${ref}`);
  let node = root;
  for (const seg of ref.slice(2).split("/")) {
    node = node?.[seg.replace(/~1/g, "/").replace(/~0/g, "~")];
    if (node === undefined) throw new Error(`$ref ${ref} resolves to nothing`);
  }
  return node;
}

function unsupported(schema) {
  for (const k of Object.keys(schema)) {
    if (!KNOWN.has(k)) throw new Error(`unsupported schema keyword: ${k}`);
  }
}

/**
 * @returns {{path: string, message: string}[]} one entry per violation,
 *          empty when the value conforms.
 */
export function validate(schema, value, { root = schema, path = "" } = {}) {
  const out = [];
  const fail = (message, at = path) => out.push({ path: at || "(root)", message });

  if (schema.$ref) return validate(resolve(schema.$ref, root), value, { root, path });
  unsupported(schema);

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => isType(value, t))) {
      fail(`expected ${types.join(" or ")}, found ${typeOf(value)}`);
      return out;                    // every other keyword would repeat this
    }
  }
  if ("const" in schema && !same(schema.const, value)) {
    fail(`expected ${JSON.stringify(schema.const)}, found ${JSON.stringify(value)}`);
  }
  if (schema.enum && !schema.enum.some((c) => same(c, value))) {
    fail(`expected one of ${schema.enum.map((c) => JSON.stringify(c)).join(", ")}, ` +
         `found ${JSON.stringify(value)}`);
  }
  if (schema.pattern !== undefined && typeof value === "string"
      && !new RegExp(schema.pattern).test(value)) {
    fail(`${JSON.stringify(value)} does not match /${schema.pattern}/`);
  }
  if (schema.minLength !== undefined && typeof value === "string" && value.length < schema.minLength) {
    fail(`shorter than ${schema.minLength} character(s)`);
  }
  if (schema.minimum !== undefined && typeof value === "number" && value < schema.minimum) {
    fail(`below the minimum of ${schema.minimum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      fail(`expected at least ${schema.minItems} item(s), found ${value.length}`);
    }
    if (schema.items) {
      value.forEach((v, i) => out.push(...validate(schema.items, v, { root, path: `${path}[${i}]` })));
    }
  }

  if (typeOf(value) === "object") {
    for (const k of schema.required ?? []) {
      if (!(k in value)) fail(`missing required property "${k}"`);
    }
    for (const [k, sub] of Object.entries(schema.properties ?? {})) {
      if (k in value) out.push(...validate(sub, value[k], { root, path: path ? `${path}.${k}` : k }));
    }
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(value)) {
        if (!(k in (schema.properties ?? {}))) fail(`property "${k}" is not allowed here`);
      }
    }
  }

  for (const sub of schema.allOf ?? []) out.push(...validate(sub, value, { root, path }));
  if (schema.anyOf && !schema.anyOf.some((sub) => validate(sub, value, { root, path }).length === 0)) {
    fail(`matches none of the ${schema.anyOf.length} allowed shapes`);
  }
  if (schema.if) {
    const branch = validate(schema.if, value, { root, path }).length === 0 ? schema.then : schema.else;
    if (branch) out.push(...validate(branch, value, { root, path }));
  }
  return out;
}
