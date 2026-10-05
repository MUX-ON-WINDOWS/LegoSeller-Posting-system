import { spawn } from "node:child_process";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const processes = [
  {
    name: "frontend",
    command: process.platform === "win32" ? process.env.ComSpec : npmCommand,
    args:
      process.platform === "win32"
        ? ["/d", "/s", "/c", `${npmCommand} --prefix frontend run dev`]
        : ["--prefix", "frontend", "run", "dev"],
  },
  {
    name: "backend",
    command: "python",
    args: [
      "-m",
      "uvicorn",
      "app.main:app",
      "--reload",
      "--host",
      "0.0.0.0",
      "--port",
      "8000",
      "--app-dir",
      "backend",
    ],
  },
];

const children = processes.map(({ name, command, args }) => {
  const child = spawn(command, args, {
    stdio: "inherit",
    windowsHide: false,
  });
  child.on("error", (error) => {
    console.error(`[${name}] kon niet starten: ${error.message}`);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (code !== 0 && signal === null) {
      console.error(`[${name}] gestopt met code ${code ?? "onbekend"}.`);
      shutdown(code || 1);
    }
  });
  return child;
});

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(exitCode), 250);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
