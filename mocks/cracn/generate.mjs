// Regenerates mocks/cracn/data.json from openapi.json.
//   node mocks/cracn/generate.mjs          write data.json
//   node mocks/cracn/generate.mjs --check  fail if data.json is out of date
import { readFileSync, writeFileSync } from "node:fs";
import { DATA_PATH, loadSpec } from "./spec.mjs";
import { buildData } from "./data.mjs";

const output = `${JSON.stringify(buildData(loadSpec()), null, 1)}\n`;
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(DATA_PATH, "utf8");
  } catch {
    // Missing file is reported below.
  }
  if (current !== output) {
    console.error(
      "mocks/cracn/data.json is out of date. Run `npm run mock:generate`.",
    );
    process.exit(1);
  }
  console.log("mocks/cracn/data.json is up to date.");
} else {
  writeFileSync(DATA_PATH, output);
  const { resources } = JSON.parse(output);
  const items = Object.values(resources).reduce(
    (n, v) => n + (Array.isArray(v) ? v.length : 1),
    0,
  );
  console.log(
    `Wrote ${Object.keys(resources).length} resources (${items} records) to mocks/cracn/data.json`,
  );
}
