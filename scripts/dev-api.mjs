import { spawn } from "node:child_process";

const child = spawn(
  "dotnet",
  ["run", "--project", "backend/Esr.Api", "--urls", "http://127.0.0.1:5080"],
  { stdio: "inherit" },
);

child.on("error", () => {
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 1));
});
