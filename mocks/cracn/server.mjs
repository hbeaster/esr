// Stateful CRACN mock server driven by openapi.json and data.json.
//   node mocks/cracn/server.mjs [--port 4010] [--host 127.0.0.1]
// Every path in the spec is routed. Resource CRUD is backed by in-memory state
// seeded from data.json; auth/permission checks always allow; other
// operations return schema-generated responses. State resets on restart or
// POST /__mock/reset.
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  API_PREFIX,
  DATA_PATH,
  buildRoutes,
  createRandom,
  deepMerge,
  generate,
  loadSpec,
  matchRoute,
  resolveRef,
  successResponse,
} from "./spec.mjs";
import { buildData, stamp } from "./data.mjs";
import { mockUser } from "./curated.mjs";

const OPERATIONS = {
  equals: (a, b) => String(a) === b,
  notEquals: (a, b) => String(a) !== b,
  greaterOrEqualTo: (a, b) => compare(a, b) >= 0,
  greaterThan: (a, b) => compare(a, b) > 0,
  lessOrEqualTo: (a, b) => compare(a, b) <= 0,
  lessThan: (a, b) => compare(a, b) < 0,
  like: (a, b) => like(a, b),
  notLike: (a, b) => !like(a, b),
  isNull: (a) => a === null || a === undefined,
  isNotNull: (a) => a !== null && a !== undefined,
  isEmpty: (a) => a === "" || (Array.isArray(a) && !a.length),
  isNotEmpty: (a) => a !== "" && !(Array.isArray(a) && !a.length) && a != null,
};

function compare(a, b) {
  const x = Number(a);
  const y = Number(b);
  return Number.isNaN(x) || Number.isNaN(y)
    ? String(a).localeCompare(b)
    : x - y;
}
function like(value, pattern) {
  if (value == null) return false;
  const source = String(pattern ?? "")
    .split("%")
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}$`, "i").test(String(value));
}
const field = (item, path) =>
  path.split(".").reduce((v, key) => (v == null ? v : v[key]), item);

/** Accepts `filters=[{...}]`, repeated `filters={...}`, or `filters[]`. */
function parseJsonParams(query, name) {
  const values = [...query.getAll(name), ...query.getAll(`${name}[]`)];
  const out = [];
  for (const raw of values) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw httpError(422, `Query parameter ${name} must be JSON.`, name);
    }
    out.push(...(Array.isArray(parsed) ? parsed : [parsed]));
  }
  return out;
}

function httpError(status, msg, loc = null) {
  return Object.assign(new Error(msg), {
    status,
    body: { msg, loc, type: "mock" },
  });
}

function applyQuery(items, query) {
  const filters = parseJsonParams(query, "filters");
  const conjunction = (query.get("conjunction") || "AND").toUpperCase();
  let result = items;
  if (filters.length) {
    const tests = filters.map(({ field: path, operation, value }) => {
      const any = operation?.startsWith("any");
      const name = any
        ? operation[3].toLowerCase() + operation.slice(4)
        : operation;
      const op = OPERATIONS[name];
      if (!op)
        throw httpError(
          422,
          `Unsupported filter operation: ${operation}`,
          "filters",
        );
      return (item) => {
        const v = field(item, path);
        return any
          ? Array.isArray(v) && v.some((x) => op(x, value))
          : op(v, value);
      };
    });
    result = result.filter((item) =>
      conjunction === "OR"
        ? tests.some((t) => t(item))
        : tests.every((t) => t(item)),
    );
  }
  for (const { field: path, ascending = true } of parseJsonParams(
    query,
    "orderBy",
  ).reverse())
    result = [...result].sort(
      (a, b) =>
        compare(field(a, path) ?? "", field(b, path) ?? "") *
        (ascending ? 1 : -1),
    );
  const limit = Math.min(Math.max(Number(query.get("limit") ?? 200), 0), 200);
  const offset = Math.max(Number(query.get("offset") ?? 0), 0);
  if (Number.isNaN(limit) || Number.isNaN(offset))
    throw httpError(422, "limit and offset must be integers.", "query");
  const page = result.slice(offset, offset + limit);
  return {
    numItems: result.length,
    startItem: offset,
    endItem: offset + page.length,
    items: page,
  };
}

/** FastAPI-style 422 for missing required body fields. */
function validateBody(spec, schema, body) {
  if (!schema) return;
  const resolved = resolveRef(spec, schema);
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw Object.assign(new Error("Invalid body"), {
      status: 422,
      body: {
        detail: [
          {
            loc: ["body"],
            msg: "Input should be an object",
            type: "model_type",
          },
        ],
      },
    });
  const missing = (resolved.required ?? []).filter(
    (k) => body[k] === undefined,
  );
  if (missing.length)
    throw Object.assign(new Error("Missing fields"), {
      status: 422,
      body: {
        detail: missing.map((k) => ({
          loc: ["body", k],
          msg: "Field required",
          type: "missing",
        })),
      },
    });
}

function hash(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function createMockServer({ spec = loadSpec(), data } = {}) {
  const { routes } = buildRoutes(spec);
  const seedData =
    data ??
    (existsSync(DATA_PATH)
      ? JSON.parse(readFileSync(DATA_PATH, "utf8"))
      : buildData(spec));
  let state = structuredClone(seedData.resources);

  const concrete = (template, params) =>
    template.replace(/\{([^}]+)\}/g, (_, p) => params[p]);
  const parentOf = (path) => path.split("/").slice(0, -1).join("/");

  const byTemplate = new Map(routes.map((r) => [r.template, r]));

  /**
   * Does the parent of `template` exist for these params? Only parameterised
   * items and singletons can be missing; literal segments always exist.
   */
  function parentExists(template, params) {
    const parent = parentOf(template);
    if (parent === API_PREFIX || !parent.startsWith(API_PREFIX)) return true;
    const route = byTemplate.get(parent);
    if (route?.kind === "item") return findItem(route, params).index >= 0;
    if (route?.kind === "singleton")
      return Boolean(state[concrete(parent, params)]);
    return parentExists(parent, params);
  }

  function findItem(route, params) {
    const key = concrete(
      route.template.split("/").slice(0, -1).join("/"),
      params,
    );
    const collection = state[key];
    const id = params[route.idField];
    const index = Array.isArray(collection)
      ? collection.findIndex((item) => String(item[route.idField]) === id)
      : -1;
    return { key, collection, index };
  }

  function handleList(route, params, method, query, body) {
    const key = concrete(route.template, params);
    if (method === "get") {
      if (route.template.includes("/-/")) {
        const pattern = new RegExp(
          "^" +
            key
              .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
              .replace("/-/", "/[^/]+/") +
            "$",
        );
        const items = Object.entries(state)
          .filter(([k, v]) => pattern.test(k) && v && !Array.isArray(v))
          .map(([, v]) => v);
        return [200, applyQuery(items, query)];
      }
      if (!parentExists(route.template, params))
        throw httpError(404, "Parent resource not found.", "path");
      return [200, applyQuery(state[key] ?? [], query)];
    }
    if (method === "post") {
      const op = route.operations.post;
      validateBody(
        spec,
        op.requestBody?.content?.["application/json"]?.schema,
        body,
      );
      if (!parentExists(route.template, params))
        throw httpError(404, "Parent resource not found.", "path");
      const itemRoute = routes.find(
        (r) => r.kind === "item" && parentOf(r.template) === route.template,
      );
      const collection = (state[key] ??= []);
      const value = structuredClone(body);
      if (itemRoute) {
        const idField = itemRoute.idField;
        if (value[idField] === undefined) {
          // System-generated integer ids.
          value[idField] =
            collection.reduce(
              (max, item) => Math.max(max, Number(item[idField]) || 0),
              0,
            ) + 1;
        }
        if (
          collection.some(
            (item) => String(item[idField]) === String(value[idField]),
          )
        )
          throw httpError(
            409,
            `${idField} ${value[idField]} already exists.`,
            idField,
          );
        stamp(
          spec,
          value,
          route.list.itemSchema,
          `${key}/${value[idField]}`,
          parentOf(key) === API_PREFIX ? null : parentOf(key),
          params,
        );
      }
      collection.push(value);
      return [successResponse(op).status, value];
    }
    throw httpError(405, "Method not allowed.");
  }

  function handleItem(route, params, method, body) {
    const { key, collection, index } = findItem(route, params);
    if (index < 0) throw httpError(404, "Not Found", "path");
    const op = route.operations[method];
    if (method === "get") return [200, collection[index]];
    if (method === "patch") {
      const { metadata, canonicalParent } = collection[index];
      const id = collection[index][route.idField];
      collection[index] = {
        ...deepMerge(collection[index], body ?? {}),
        metadata,
        canonicalParent,
        [route.idField]: id,
      };
      return [successResponse(op).status, collection[index]];
    }
    if (method === "delete") {
      const path = `${key}/${params[route.idField]}`;
      collection.splice(index, 1);
      for (const k of Object.keys(state))
        if (k.startsWith(`${path}/`)) delete state[k];
      return [successResponse(op).status, null];
    }
    throw httpError(405, "Method not allowed.");
  }

  function handleSingleton(route, params, method, body) {
    const key = concrete(route.template, params);
    if (!parentExists(route.template, params))
      throw httpError(404, "Parent resource not found.", "path");
    const op = route.operations[method];
    const current = state[key];
    if (method === "get") {
      if (!current) throw httpError(404, "Not Found", "path");
      return [200, current];
    }
    if (method === "post") {
      validateBody(
        spec,
        op.requestBody?.content?.["application/json"]?.schema,
        body,
      );
      if (current) throw httpError(409, "Resource already exists.", "path");
      state[key] = stamp(
        spec,
        structuredClone(body),
        successResponse(op).schema,
        key,
        parentOf(key),
        params,
      );
      return [successResponse(op).status, state[key]];
    }
    if (!current) throw httpError(404, "Not Found", "path");
    if (method === "patch") {
      state[key] = {
        ...deepMerge(current, body ?? {}),
        metadata: current.metadata,
        canonicalParent: current.canonicalParent,
      };
      return [successResponse(op).status, state[key]];
    }
    if (method === "delete") {
      delete state[key];
      for (const k of Object.keys(state))
        if (k.startsWith(`${key}/`)) delete state[k];
      return [successResponse(op).status, null];
    }
    throw httpError(405, "Method not allowed.");
  }

  function handleAction(route, method, path) {
    const op = route.operations[method];
    const { status, schema } = successResponse(op);
    if (route.template === `${API_PREFIX}/auth/user`) return [status, mockUser];
    if (!schema) return [status, null];
    const permissive = route.template.includes("/auth/");
    const random = createRandom(hash(`${method} ${path}`));
    const value = generate(
      spec,
      schema,
      random,
      permissive ? { booleans: true, optionalSkipRate: 0 } : {},
    );
    if (permissive && value && typeof value === "object")
      for (const [k, v] of Object.entries(value))
        if (Array.isArray(v)) value[k] = [];
    return [status, value];
  }

  function dispatch(method, url, body, headers) {
    if (url.pathname === "/__mock/health")
      return [200, { status: "ok", spec: spec.info }];
    if (url.pathname === "/__mock/reset" && method === "post") {
      state = structuredClone(seedData.resources);
      return [204, null];
    }
    if (!/^Bearer \S+/.test(headers.authorization ?? ""))
      throw httpError(401, "Invalid JWT", "header");
    const match = matchRoute(routes, url.pathname);
    if (!match) throw httpError(404, "Not Found", "path");
    const { route, params } = match;
    if (!route.operations[method]) throw httpError(405, "Method not allowed.");
    if (route.kind === "list")
      return handleList(route, params, method, url.searchParams, body);
    if (route.kind === "item") return handleItem(route, params, method, body);
    if (route.kind === "singleton")
      return handleSingleton(route, params, method, body);
    return handleAction(route, method, url.pathname);
  }

  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (c) => chunks.push(c));
    request.on("end", () => {
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      response.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      );
      const method = (request.method ?? "GET").toLowerCase();
      if (method === "options") {
        response.writeHead(204).end();
        return;
      }
      let status;
      let payload;
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        let body;
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            throw httpError(422, "Request body must be JSON.", "body");
          }
        }
        const url = new URL(request.url ?? "/", "http://mock");
        [status, payload] = dispatch(method, url, body, request.headers);
      } catch (error) {
        status = error.status ?? 500;
        payload = error.body ?? {
          msg: String(error.message ?? error),
          loc: null,
          type: "mock",
        };
        if (!error.status) console.error(error);
      }
      if (status === 204) {
        response.writeHead(204).end();
        return;
      }
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(payload));
    });
  });
  return server;
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : fallback;
  };
  const port = Number(arg("port", process.env.CRACN_MOCK_PORT ?? 4010));
  const host = arg("host", process.env.CRACN_MOCK_HOST ?? "127.0.0.1");
  const server = createMockServer();
  server.listen(port, host, () => {
    const address = server.address();
    console.log(`CRACN mock listening on http://${host}:${address.port}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
