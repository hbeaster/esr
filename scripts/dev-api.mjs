// Starts the demo API for local development (`npm run dev:api`).
//
// The npm script loads .env first with Node's --env-file-if-exists, so the
// same file serves Docker Compose and dev mode. Compose-style names
// (CHAT_API_KEY, CHAT_BASE_URL, CHAT_MODEL) map to the API's configuration
// names (Chat__ApiKey, ...). A value already set in the shell wins. With no
// key, the API serves the labeled mock assistant.
//
// It runs two copies of the API:
// - http://127.0.0.1:5080, the normal API behind "Use API data".
// - http://127.0.0.1:5081, a sandbox the dev server loads with simulated
//   records, so "Use fake data" can run the whole workflow through
//   Workflow.cs. Set ESR_SIMULATED_API=off to skip it.
// Both keep data in memory, so a restart resets them.
import { spawn, spawnSync } from "node:child_process";

const names = {
  CHAT_API_KEY: "Chat__ApiKey",
  CHAT_BASE_URL: "Chat__BaseUrl",
  CHAT_MODEL: "Chat__Model",
};
const env = { ...process.env };
for (const [from, to] of Object.entries(names))
  if (env[from] && !env[to]) env[to] = env[from];

// Report the mode without printing the key.
console.log(
  env.Chat__ApiKey
    ? `Assistant chat: ${env.Chat__Model || "gpt-4o-mini"} via ${env.Chat__BaseUrl || "https://api.openai.com/v1"}`
    : "Assistant chat: labeled mock (no CHAT_API_KEY in .env or Chat__ApiKey in the shell)",
);

const dotnet = env.DOTNET_BIN || "dotnet";
const project = ["--project", "backend/Esr.Api"];
// Build once: two `dotnet run` builds of one project at the same time collide.
const build = spawnSync(
  dotnet,
  ["build", ...project.slice(1), "--nologo", "-v", "q"],
  {
    stdio: "inherit",
    env,
  },
);
if (build.status !== 0) process.exit(build.status ?? 1);

const run = (port, extra = {}) =>
  spawn(
    dotnet,
    [
      "run",
      "--no-build",
      ...project,
      "--urls",
      `http://127.0.0.1:${port}`,
      ...process.argv.slice(2),
    ],
    { stdio: "inherit", env: { ...env, ...extra } },
  );
const apis = [run(5080)];
if (env.ESR_SIMULATED_API !== "off") {
  console.log(
    "Simulated-data sandbox: http://127.0.0.1:5081 (Use fake data can sign and submit)",
  );
  apis.push(
    run(5081, {
      ASPNETCORE_ENVIRONMENT: "Development",
      Demo__AcceptSimulatedData: "true",
    }),
  );
}

let stopping = false;
const stop = (signal) => {
  stopping = true;
  for (const api of apis) api.kill(signal);
};
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => stop(signal));
// If either API exits, stop the other so the pair never runs half up.
for (const api of apis)
  api.on("exit", (code, signal) => {
    if (!stopping) stop("SIGTERM");
    if (apis.every((a) => a.exitCode !== null || a.signalCode !== null))
      process.exit(code ?? (signal ? 1 : 0));
  });
