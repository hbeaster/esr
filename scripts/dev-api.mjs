// Starts the demo API for local development (`npm run dev:api`).
//
// The npm script loads .env first with Node's --env-file-if-exists, so the
// same file serves Docker Compose and dev mode. Compose-style names
// (CHAT_API_KEY, CHAT_BASE_URL, CHAT_MODEL) map to the API's configuration
// names (Chat__ApiKey, ...). A value already set in the shell wins. With no
// key, the API serves the labeled mock assistant.
import { spawn } from "node:child_process";

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

const api = spawn(
  env.DOTNET_BIN || "dotnet",
  [
    "run",
    "--project",
    "backend/Esr.Api",
    "--urls",
    "http://127.0.0.1:5080",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => api.kill(signal));
api.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
