import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IncomingMessage } from "node:http";
import type { Plugin } from "vite";
import { SIMULATED_API_BASE } from "./base";
import { createSimulatedApi } from "./handler";
import type { SimulatedSeed } from "./data";

/** Only these POST routes use a body; workflow writes are rejected unread. */
const ROUTES_WITH_BODY = new Set(["/demo/session", "/history/search"]);

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** Serves fake data from the dev server only; builds never include this plugin. */
export function simulatedApiPlugin(): Plugin {
  return {
    name: "esr-simulated-api",
    apply: "serve",
    configureServer(server) {
      // Read here, not at import: the Docker frontend stage has no backend folder.
      const seed = JSON.parse(
        readFileSync(
          resolve(server.config.root, "backend/Esr.Api/seed.json"),
          "utf8",
        ),
      ) as SimulatedSeed;
      const handle = createSimulatedApi(seed);

      server.middlewares.use(SIMULATED_API_BASE, (req, res, next) => {
        void (async () => {
          const url = new URL(req.url ?? "/", "http://simulated.local");
          let body: unknown;
          if (req.method === "POST" && ROUTES_WITH_BODY.has(url.pathname)) {
            try {
              body = await readJson(req);
            } catch {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Malformed request." }));
              return;
            }
          } else req.resume();

          const result = handle({
            method: req.method ?? "GET",
            path: url.pathname,
            query: url.searchParams,
            authorization: req.headers.authorization,
            body,
          });
          res.statusCode = result.status;
          res.setHeader("Cache-Control", "no-store");
          if ("bytes" in result) {
            res.setHeader("Content-Type", result.type);
            res.end(Buffer.from(result.bytes));
          } else {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result.json));
          }
        })().catch(next);
      });
    },
  };
}
