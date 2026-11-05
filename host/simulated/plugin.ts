import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IncomingMessage } from "node:http";
import { loadEnv } from "vite";
import type { Plugin } from "vite";
import { SIMULATED_API_BASE } from "./base";
import { createSimulatedApi } from "./handler";
import { ChatFailure, completeChat } from "./chat";
import { createSandbox } from "./sandbox";
import type { ChatProvider } from "./chat";
import type { SimulatedSeed } from "./data";

/** Only these POST routes use a body; workflow writes are rejected unread. */
const ROUTES_WITH_BODY = new Set([
  "/demo/session",
  "/history/search",
  "/assistant/chat",
]);

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
      // Same .env as Compose and `npm run dev:api`. The key stays in this
      // server process; Vite only exposes VITE_-prefixed values to the page.
      const env = loadEnv(server.config.mode, server.config.root, [
        "CHAT_",
        "Chat__",
        "ESR_",
      ]);
      // The writable sandbox API that `npm run dev:api` starts. "off" keeps simulated data read-only.
      const sandboxUrl = env.ESR_SIMULATED_API || "http://127.0.0.1:5081";
      const sandbox =
        sandboxUrl === "off" ? null : createSandbox(sandboxUrl, seed);
      server.config.logger.info(
        sandbox
          ? `  Simulated data: writable through ${sandboxUrl} while npm run dev:api runs, read-only otherwise`
          : "  Simulated data: read-only (ESR_SIMULATED_API=off)",
      );
      const apiKey = env.Chat__ApiKey || env.CHAT_API_KEY || "";
      const provider: ChatProvider | null = apiKey.trim()
        ? {
            apiKey,
            baseUrl:
              env.Chat__BaseUrl ||
              env.CHAT_BASE_URL ||
              "https://api.openai.com/v1",
            model: env.Chat__Model || env.CHAT_MODEL || "gpt-4o-mini",
            timeoutMs: 60_000,
          }
        : null;
      server.config.logger.info(
        provider
          ? `  Simulated-data chat: ${provider.model} via ${provider.baseUrl}`
          : "  Simulated-data chat: labeled mock (no CHAT_API_KEY in .env)",
      );

      server.middlewares.use(SIMULATED_API_BASE, (req, res, next) => {
        void (async () => {
          const url = new URL(req.url ?? "/", "http://simulated.local");
          // Writable simulated data: the sandbox runs the real workflow.
          if (sandbox && (await sandbox.ready())) {
            sandbox.forward(req, res, `${url.pathname}${url.search}`);
            return;
          }
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

          if (
            provider &&
            req.method === "POST" &&
            url.pathname === "/assistant/chat"
          ) {
            const prepared = handle.prepareChat({
              authorization: req.headers.authorization,
              body,
            });
            let status = 200;
            let payload: unknown;
            if ("failure" in prepared) {
              status = prepared.failure.status;
              payload = "json" in prepared.failure ? prepared.failure.json : {};
            } else
              try {
                const answer = await completeChat(provider, prepared.turns);
                payload = { ...answer, mock: false };
              } catch (cause) {
                status = cause instanceof ChatFailure ? cause.status : 502;
                payload = {
                  error:
                    cause instanceof ChatFailure
                      ? cause.message
                      : "The chat provider failed.",
                };
              }
            res.statusCode = status;
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(payload));
            return;
          }
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
