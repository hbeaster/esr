// Builds the CRACN mock dataset from openapi.json: every list resource gets
// deterministic items, nested resources hang off each parent instance, and
// cross-resource refs point at records that actually exist.
import {
  API_PREFIX,
  buildRoutes,
  createRandom,
  deepMerge,
  generate,
  resolveRef,
  resourceName,
  resourceType,
} from "./spec.mjs";
import { curated } from "./curated.mjs";

const ROOT_COUNT = 5;
const NESTED_COUNT = 2;

const parentTemplate = (template) => template.split("/").slice(0, -1).join("/");
const lastSegment = (path) => path.split("/").at(-1);

/** Fills a `{ref, uniqueness}` canonical-parent object from path params. */
function canonicalParent(spec, schema, ref, params) {
  const uniquenessSchema = resolveRef(
    spec,
    resolveRef(spec, schema).properties?.uniqueness,
  );
  const uniqueness = {};
  for (const key of Object.keys(uniquenessSchema.properties ?? {}))
    if (key in params) uniqueness[key] = params[key];
  return { ref, uniqueness };
}

/** Sets server-owned fields: metadata.name/resourceType and canonicalParent. */
export function stamp(spec, value, schema, path, parentPath, params) {
  const properties = resolveRef(spec, schema).properties ?? {};
  if (properties.metadata)
    value.metadata = {
      name: resourceName(path),
      resourceType: resourceType(spec, schema),
    };
  if (properties.canonicalParent && parentPath)
    value.canonicalParent = canonicalParent(
      spec,
      properties.canonicalParent,
      resourceName(parentPath),
      params,
    );
  return value;
}

export function buildData(spec, seed = 20260184) {
  const random = createRandom(seed);
  const { routes } = buildRoutes(spec);
  const resources = {};
  const entities = []; // { template, name, params }

  const children = (template) =>
    routes.filter(
      (r) =>
        (r.kind === "list" || r.kind === "singleton") &&
        parentTemplate(r.template) === template &&
        !r.template.includes("/-/") &&
        !r.template.includes("/auth/"),
    );

  function populate(instancePath, template, params) {
    for (const child of children(template)) {
      const path = `${instancePath}/${lastSegment(child.template)}`;
      if (child.kind === "singleton") {
        const schema =
          child.operations.get && successSchema(child.operations.get);
        const value = stamp(
          spec,
          generate(spec, schema, random),
          schema,
          path,
          instancePath,
          params,
        );
        resources[path] = value;
        entities.push({
          template: child.template,
          name: resourceName(path),
          params,
        });
        populate(path, child.template, params);
        continue;
      }
      const itemRoute = routes.find(
        (r) =>
          r.kind === "item" && parentTemplate(r.template) === child.template,
      );
      const idField = itemRoute?.idField;
      const schema = child.list.itemSchema;
      const items = [];
      const seeds = curated[path] ?? [];
      const count = Math.max(
        seeds.length,
        template === API_PREFIX ? ROOT_COUNT : NESTED_COUNT,
      );
      for (let n = 0; n < count; n++) {
        let value = generate(spec, schema, random);
        if (seeds[n]) value = deepMerge(value, seeds[n]);
        if (idField) {
          const idSchema = resolveRef(spec, schema).properties[idField];
          if (!seeds[n]?.[idField])
            value[idField] = idValue(spec, idField, idSchema, n, random);
          // Regenerate on id collisions so item paths stay unique.
          let attempts = 0;
          while (
            items.some((i) => String(i[idField]) === String(value[idField])) &&
            attempts++ < 20
          )
            value[idField] = idValue(
              spec,
              idField,
              idSchema,
              n + attempts * 7,
              random,
            );
          if (items.some((i) => String(i[idField]) === String(value[idField])))
            continue;
        }
        const itemPath = idField ? `${path}/${value[idField]}` : path;
        const itemParams = idField
          ? { ...params, [idField]: value[idField] }
          : params;
        stamp(
          spec,
          value,
          schema,
          itemPath,
          template === API_PREFIX ? null : instancePath,
          params,
        );
        items.push(value);
        if (itemRoute) {
          entities.push({
            template: itemRoute.template,
            name: resourceName(itemPath),
            params: itemParams,
          });
          populate(itemPath, itemRoute.template, itemParams);
        }
      }
      resources[path] = items;
    }
  }

  populate(API_PREFIX, API_PREFIX, {});
  // Read-only views under a non-resource segment, e.g. /aggregations/x.
  for (const route of routes)
    if (
      route.kind === "list" &&
      route.params.length === 0 &&
      !route.template.includes("/-/") &&
      parentTemplate(route.template) !== API_PREFIX
    )
      resources[route.template] = Array.from({ length: ROOT_COUNT }, () =>
        generate(spec, route.list.itemSchema, random),
      );

  resolveRefs(resources, entities, random);
  return {
    generatedFrom: { title: spec.info.title, version: spec.info.version, seed },
    resources: Object.fromEntries(
      Object.entries(resources).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}

/** Identifier values: sequential integers, spec patterns, or code-like strings. */
function idValue(spec, idField, schema, n, random) {
  if (schema?.type === "integer") return Math.max(schema.minimum ?? 1, 1) + n;
  if (schema?.pattern || schema?.enum) return generate(spec, schema, random);
  const max = schema?.maxLength ?? 12;
  const example = schema?.examples?.find((e) => typeof e === "string");
  if (idField === "jcnOrMjfcn")
    return `JCN-26${String(random.int(1000, 9999))}`;
  if (example && /^[0-9]+$/.test(example))
    return String(random.int(1, 10 ** example.length - 1)).padStart(
      example.length,
      "0",
    );
  return `${idField.slice(0, 3).toUpperCase()}${random.int(10000, 99999)}`.slice(
    0,
    max,
  );
}

function successSchema(operation) {
  const code = Object.keys(operation.responses).find((c) => c.startsWith("2"));
  return operation.responses[code]?.content?.["application/json"]?.schema;
}

/**
 * Generated `{ref, uniqueness}` objects hold random but pattern-valid refs.
 * Point each at a real entity of the matching resource type; refs that already
 * resolve (curated data) are kept.
 */
function resolveRefs(resources, entities, random) {
  const byName = new Map(entities.map((e) => [e.name, e]));
  const templates = [...new Set(entities.map((e) => e.template))].map(
    (template) => ({
      template,
      regex: new RegExp(
        "^" +
          resourceName(template)
            .split("/")
            .map((s) => (/^\{.+\}$/.test(s) ? "[^/]+" : s))
            .join("/") +
          "$",
      ),
      entities: entities.filter((e) => e.template === template),
    }),
  );
  const visit = (value, key, owner) => {
    if (Array.isArray(value)) return value.forEach((v) => visit(v, key, owner));
    if (!value || typeof value !== "object") return;
    if (typeof value.metadata?.name === "string") owner = value.metadata.name;
    if (
      key !== "canonicalParent" &&
      typeof value.ref === "string" &&
      value.uniqueness &&
      typeof value.uniqueness === "object" &&
      !byName.has(value.ref)
    ) {
      const target = templates
        .filter((t) => t.regex.test(value.ref))
        .sort((a, b) => b.template.length - a.template.length)[0];
      const candidates = target?.entities.filter((e) => e.name !== owner) ?? [];
      if (candidates.length) {
        const entity = random.pick(candidates);
        value.ref = entity.name;
        for (const k of Object.keys(value.uniqueness))
          if (k in entity.params) value.uniqueness[k] = entity.params[k];
      }
    }
    for (const [k, v] of Object.entries(value))
      if (k !== "metadata") visit(v, k, owner);
  };
  for (const value of Object.values(resources)) visit(value, "", "");
}
