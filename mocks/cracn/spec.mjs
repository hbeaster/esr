// Shared helpers for the CRACN mock: loads openapi.json, classifies its routes
// and generates deterministic schema-conformant values.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SPEC_PATH = fileURLToPath(
  new URL("../../openapi.json", import.meta.url),
);
export const DATA_PATH = fileURLToPath(new URL("./data.json", import.meta.url));
export const API_PREFIX = "/api/v1";
const METHODS = ["get", "post", "put", "patch", "delete"];

export function loadSpec(path = SPEC_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Deterministic PRNG (mulberry32) so regenerating produces identical data. */
export function createRandom(seed = 1) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}

export function resolveRef(spec, schema) {
  let current = schema;
  while (current && current.$ref) {
    const name = current.$ref.split("/").pop();
    current = spec.components.schemas[name];
  }
  return current ?? {};
}

export const schemaName = (schema) => schema?.$ref?.split("/").pop();

/** The JSON schema of the first 2xx response, plus its status code. */
export function successResponse(operation) {
  const code = Object.keys(operation.responses ?? {}).find((c) =>
    c.startsWith("2"),
  );
  const schema =
    code && operation.responses[code].content?.["application/json"]?.schema;
  return { status: code ? Number(code) : 200, schema: schema || null };
}

const isPage = (spec, schema) =>
  Boolean(schemaName(schema)?.startsWith("Page_")) &&
  "items" in (resolveRef(spec, schema).properties ?? {});

/**
 * Classifies each spec path:
 *  - list:      GET returns Page_X_; items are stored under the concrete path
 *  - item:      direct child `{param}` of a list template
 *  - singleton: GET returns one object and is not an item (e.g. planningForm)
 *  - action:    everything else (auth checks, createFromCopy, …)
 */
export function buildRoutes(spec) {
  const paths = spec.paths;
  const lists = new Map();
  for (const [template, ops] of Object.entries(paths)) {
    if (ops.get && isPage(spec, successResponse(ops.get).schema)) {
      const page = resolveRef(spec, successResponse(ops.get).schema);
      lists.set(template, {
        itemSchema: page.properties.items.items,
        createSchema:
          ops.post?.requestBody?.content?.["application/json"]?.schema,
      });
    }
  }
  const routes = [];
  for (const [template, ops] of Object.entries(paths)) {
    const segments = template.split("/");
    const parent = segments.slice(0, -1).join("/");
    const last = segments.at(-1);
    let kind = "action";
    let idField = null;
    if (lists.has(template)) kind = "list";
    else if (lists.has(parent) && /^\{.+\}$/.test(last)) {
      kind = "item";
      idField = last.slice(1, -1);
    } else if (
      ops.get &&
      !template.includes("/auth/") &&
      successResponse(ops.get).schema
    )
      kind = "singleton";
    const params = segments
      .filter((s) => /^\{.+\}$/.test(s))
      .map((s) => s.slice(1, -1));
    const literalCount = segments.filter((s) => !/^\{.+\}$/.test(s)).length;
    const regex = new RegExp(
      "^" +
        segments
          .map((s) =>
            /^\{.+\}$/.test(s)
              ? "([^/]+)"
              : s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&"),
          )
          .join("/") +
        "$",
    );
    routes.push({
      template,
      kind,
      idField,
      params,
      regex,
      literalCount,
      list: kind === "item" ? lists.get(parent) : lists.get(template),
      operations: Object.fromEntries(
        Object.entries(ops).filter(([m]) => METHODS.includes(m)),
      ),
    });
  }
  // Prefer the most literal match, e.g. /jobs/-/planningForm over /jobs/{jcn}.
  routes.sort(
    (a, b) =>
      b.literalCount - a.literalCount ||
      b.template.split("/").length - a.template.split("/").length,
  );
  return { routes, lists };
}

export function matchRoute(routes, path) {
  for (const route of routes) {
    const match = route.regex.exec(path);
    if (match) {
      const values = match.slice(1).map(decodeURIComponent);
      return {
        route,
        params: Object.fromEntries(route.params.map((p, i) => [p, values[i]])),
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pattern-aware string generation

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SAFE = UPPER + DIGITS;

function parseClass(source, start) {
  let i = start + 1;
  let negate = false;
  if (source[i] === "^") {
    negate = true;
    i++;
  }
  const chars = [];
  while (i < source.length && source[i] !== "]") {
    let c = source[i];
    if (c === "\\") {
      const e = source[++i];
      if (e === "d") chars.push(...DIGITS);
      else if (e === "w") chars.push(...SAFE, ..."abcdefghijklmnopqrstuvwxyz_");
      else if (e === "s") chars.push(" ");
      else chars.push(e);
      i++;
      continue;
    }
    if (source[i + 1] === "-" && source[i + 2] && source[i + 2] !== "]") {
      const from = c.charCodeAt(0);
      const to = source[i + 2].charCodeAt(0);
      for (let code = from; code <= to; code++)
        chars.push(String.fromCharCode(code));
      i += 3;
      continue;
    }
    chars.push(c);
    i++;
  }
  let set = [...new Set(chars)];
  if (negate) set = [...SAFE].filter((c) => !set.includes(c));
  // Prefer readable characters when the class allows them.
  const readable = set.filter((c) => SAFE.includes(c));
  return { set: readable.length ? readable : set, end: i + 1 };
}

function parseQuantifier(source, i) {
  const c = source[i];
  if (c === "?") return { min: 0, max: 1, end: i + 1 };
  if (c === "*") return { min: 0, max: 3, end: i + 1 };
  if (c === "+") return { min: 1, max: 4, end: i + 1 };
  if (c === "{") {
    const close = source.indexOf("}", i);
    const [a, b] = source.slice(i + 1, close).split(",");
    const min = Number(a);
    const max = b === undefined ? min : b === "" ? min + 3 : Number(b);
    return { min, max, end: close + 1 };
  }
  return { min: 1, max: 1, end: i };
}

/** Generates a string for simple regexes (classes, literals, quantifiers). */
function fromPattern(pattern, random) {
  if (/\(\?[=!<]|\|/.test(pattern)) return null; // lookarounds / alternation
  const source = pattern.replace(/^\^/, "").replace(/\$$/, "");
  let out = "";
  let i = 0;
  while (i < source.length) {
    let set;
    const c = source[i];
    if (c === "[") {
      const parsed = parseClass(source, i);
      set = parsed.set;
      i = parsed.end;
    } else if (c === "\\") {
      const e = source[i + 1];
      set = e === "d" ? [...DIGITS] : e === "w" ? [...SAFE] : [e];
      i += 2;
    } else if (c === ".") {
      set = [...SAFE];
      i++;
    } else if (c === "(" || c === ")") {
      return null;
    } else {
      set = [c];
      i++;
    }
    const q = parseQuantifier(source, i);
    i = q.end;
    const count = random.int(q.min, Math.min(q.max, q.min + 6));
    for (let n = 0; n < count; n++) out += random.pick(set);
  }
  return out;
}

const WORDS = [
  "pump",
  "valve",
  "coupling",
  "actuator",
  "bearing",
  "flange",
  "gasket",
  "motor",
  "panel",
  "sensor",
  "hydraulic",
  "seawater",
  "auxiliary",
  "inspect",
  "replace",
  "repair",
  "overhaul",
  "align",
];

function stringValue(schema, key, random) {
  const max = schema.maxLength ?? 40;
  const min = schema.minLength ?? 0;
  const example = schema.examples?.find(
    (e) => typeof e === "string" && !e.includes("{"),
  );
  const valid = (s) =>
    s.length >= min &&
    s.length <= max &&
    (!schema.pattern || new RegExp(schema.pattern, "u").test(s));
  if (schema.format === "date-time") {
    const day = random.int(0, 650);
    return new Date(Date.UTC(2025, 0, 1) + day * 86400000).toISOString();
  }
  if (schema.pattern) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const s = fromPattern(schema.pattern, random);
      if (s !== null && valid(s)) return s;
    }
    if (/^\^\(\?!/.test(schema.pattern)) {
      const s = `${random.int(1, 9999)}.${random.int(10, 99)}`;
      if (valid(s)) return s;
    }
    if (example && valid(example)) return example;
    throw new Error(`Cannot generate a value for pattern ${schema.pattern}`);
  }
  if (example && valid(example) && random.next() < 0.3) return example;
  if (/date/i.test(key) && max >= 10) {
    const day = random.int(0, 650);
    return new Date(Date.UTC(2025, 0, 1) + day * 86400000)
      .toISOString()
      .slice(0, 10);
  }
  if (max <= 6) {
    let s = "";
    const length = Math.max(min, Math.min(max, random.int(1, max)));
    for (let n = 0; n < length; n++) s += random.pick([...SAFE]);
    return s;
  }
  const words = [];
  const target = random.int(2, 5);
  while (words.length < target) words.push(random.pick(WORDS));
  let text = words.join(" ");
  text = text[0].toUpperCase() + text.slice(1);
  return text.slice(0, max).trimEnd().padEnd(min, "X");
}

/**
 * Generates a value for `schema`. Optional properties are included about half
 * the time; nullable unions return null occasionally to exercise clients.
 */
export function generate(
  spec,
  schema,
  random,
  options = {},
  key = "",
  depth = 0,
) {
  if (!schema || depth > 12) return null;
  if (schema.$ref)
    return generate(
      spec,
      resolveRef(spec, schema),
      random,
      options,
      key,
      depth + 1,
    );
  if (schema.const !== undefined) return schema.const;
  if (schema.anyOf || schema.oneOf) {
    const variants = schema.anyOf || schema.oneOf;
    const concrete = variants.filter(
      (v) => v.type !== "null" && Object.keys(v).length > 0,
    );
    if (!concrete.length) return null;
    if (
      variants.length > concrete.length &&
      random.next() < (options.nullRate ?? 0.15)
    )
      return null;
    return generate(
      spec,
      random.pick(concrete),
      random,
      options,
      key,
      depth + 1,
    );
  }
  if (schema.allOf) {
    return Object.assign(
      {},
      ...schema.allOf.map((s) =>
        generate(spec, s, random, options, key, depth + 1),
      ),
    );
  }
  if (schema.enum) return schema.enum.length ? random.pick(schema.enum) : null;
  const type = Array.isArray(schema.type)
    ? schema.type.find((t) => t !== "null")
    : schema.type;
  switch (type) {
    case "string":
      return stringValue(schema, key, random);
    case "integer": {
      const min = Math.ceil(
        schema.minimum ??
          (schema.exclusiveMinimum ?? 0) +
            (schema.exclusiveMinimum !== undefined ? 1 : 0),
      );
      const max = Math.floor(schema.maximum ?? Math.max(min + 99, 99));
      return random.int(min, max);
    }
    case "number": {
      const min = schema.minimum ?? 0;
      const max = schema.maximum ?? min + 1000;
      return Math.round((min + random.next() * (max - min)) * 100) / 100;
    }
    case "boolean":
      return options.booleans ?? random.next() < 0.5;
    case "array": {
      if (schema.items?.enum && !schema.items.enum.length) return [];
      const min = schema.minItems ?? 0;
      const max = schema.maxItems ?? Math.max(min, 2);
      const count = random.int(min, Math.min(max, min + 2));
      return Array.from({ length: count }, () =>
        generate(spec, schema.items, random, options, key, depth + 1),
      ).filter((v) => v !== null);
    }
    case "object":
    default: {
      if (!schema.properties) return type === "object" ? {} : null;
      const required = new Set(schema.required ?? []);
      const out = {};
      for (const [name, property] of Object.entries(schema.properties)) {
        if (
          !required.has(name) &&
          random.next() < (options.optionalSkipRate ?? 0.4)
        )
          continue;
        const value = generate(
          spec,
          property,
          random,
          options,
          name,
          depth + 1,
        );
        if (value !== null || required.has(name)) out[name] = value;
      }
      return out;
    }
  }
}

/** The metadata.resourceType example, e.g. cracn.projectblue.mil/Job. */
export function resourceType(spec, itemSchema) {
  const metadata = resolveRef(spec, itemSchema).properties?.metadata;
  const example = metadata?.examples?.[0]?.resourceType;
  return (
    example || `cracn.projectblue.mil/${schemaName(itemSchema) ?? "Resource"}`
  );
}

/** Resource name used by CRACN refs: the concrete path without /api/v1/. */
export const resourceName = (path) => path.slice(API_PREFIX.length + 1);

export function deepMerge(target, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return patch;
  const out = { ...(target && typeof target === "object" ? target : {}) };
  for (const [k, v] of Object.entries(patch))
    out[k] =
      v && typeof v === "object" && !Array.isArray(v)
        ? deepMerge(out[k], v)
        : v;
  return out;
}
