#!/usr/bin/env node
// Local debug launcher for backend (server) + frontend (client).
// Usage: node scripts/dev.mjs {start|stop|restart|status|logs [server|client|all]}
//
// Cross-platform: identifies and kills processes by listening port so it
// works the same on Windows (PowerShell/cmd/Git Bash) and macOS/Linux.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const RUN_DIR = join(ROOT, ".dev");
mkdirSync(RUN_DIR, { recursive: true });

const IS_WIN = process.platform === "win32";
const NPM = IS_WIN ? "npm.cmd" : "npm";

const services = {
  server: {
    dir: join(ROOT, "server"),
    port: 3001,
    pidFile: join(RUN_DIR, "server.pid"),
    logFile: join(RUN_DIR, "server.log"),
  },
  client: {
    dir: join(ROOT, "client"),
    port: 5173,
    pidFile: join(RUN_DIR, "client.pid"),
    logFile: join(RUN_DIR, "client.log"),
  },
};

function pidsOnPort(port) {
  if (IS_WIN) {
    const out = spawnSync("netstat", ["-ano"], { encoding: "utf8" }).stdout || "";
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      // TCP   0.0.0.0:3001   0.0.0.0:0   LISTENING   12345
      const parts = line.trim().split(/\s+/);
      if (parts[0] !== "TCP" || parts[3] !== "LISTENING") continue;
      const local = parts[1] || "";
      if (local.endsWith(":" + port)) pids.add(parts[4]);
    }
    return [...pids];
  }
  // Try lsof first, fall back to ss.
  let r = spawnSync("lsof", ["-nP", "-iTCP:" + port, "-sTCP:LISTEN", "-t"], { encoding: "utf8" });
  if (r.status === 0 && r.stdout) {
    return [...new Set(r.stdout.split(/\s+/).filter(Boolean))];
  }
  r = spawnSync("ss", ["-ltnp", `sport = :${port}`], { encoding: "utf8" });
  if (r.status === 0 && r.stdout) {
    const pids = new Set();
    for (const line of r.stdout.split(/\r?\n/).slice(1)) {
      const m = line.match(/pid=(\d+)/);
      if (m) pids.add(m[1]);
    }
    return [...pids];
  }
  return [];
}

const isPortUp = (port) => pidsOnPort(port).length > 0;

function killPid(pid) {
  if (IS_WIN) {
    spawnSync("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" });
  } else {
    try { process.kill(Number(pid), "SIGTERM"); } catch {}
    spawnSync("sh", ["-c", `sleep 1; kill -0 ${pid} 2>/dev/null && kill -KILL ${pid}`], { stdio: "ignore" });
  }
}

async function startOne(name) {
  const s = services[name];
  if (isPortUp(s.port)) {
    console.log(`[${name}] already running on :${s.port} (pid ${pidsOnPort(s.port).join(" ")})`);
    return true;
  }
  console.log(`[${name}] starting in ${s.dir} ...`);
  writeFileSync(s.logFile, "");
  const out = openSync(s.logFile, "a");
  const child = spawn(NPM, ["run", "dev"], {
    cwd: s.dir,
    stdio: ["ignore", out, out],
    detached: !IS_WIN, // own process group on POSIX; on Windows we tree-kill by pid anyway
    shell: IS_WIN, // Node 18+ requires shell:true to spawn .cmd on Windows (CVE-2024-27980)
    windowsHide: true,
  });
  child.unref();
  writeFileSync(s.pidFile, String(child.pid));

  for (let i = 0; i < 60; i++) {
    if (isPortUp(s.port)) {
      console.log(`[${name}] up on :${s.port} (pid ${pidsOnPort(s.port).join(" ")}) | log: ${s.logFile}`);
      return true;
    }
    await sleep(500);
  }
  console.log(`[${name}] did NOT come up on :${s.port} within 30s. Tail of log:`);
  printTail(s.logFile, 30);
  return false;
}

function stopOne(name) {
  const s = services[name];
  const pids = pidsOnPort(s.port);
  if (pids.length === 0) {
    console.log(`[${name}] not running on :${s.port}`);
    if (existsSync(s.pidFile)) rmSync(s.pidFile);
    return;
  }
  console.log(`[${name}] stopping pid(s) on :${s.port} -> ${pids.join(" ")}`);
  for (const pid of pids) killPid(pid);

  if (existsSync(s.pidFile)) {
    const recorded = readFileSync(s.pidFile, "utf8").trim();
    if (recorded && !pids.includes(recorded)) killPid(recorded);
    rmSync(s.pidFile);
  }
  console.log(`[${name}] stopped`);
}

function printTail(file, n) {
  if (!existsSync(file)) return;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  console.log(lines.slice(-n).join("\n"));
}

function tailFollow(files) {
  // Simple cross-platform tail -f: poll for size changes.
  const state = files.map((f) => ({ file: f, size: existsSync(f) ? readFileSync(f).length : 0 }));
  console.log(`(tailing ${files.map((f) => "\n  " + f).join("")})\n--`);
  setInterval(() => {
    for (const s of state) {
      if (!existsSync(s.file)) continue;
      const buf = readFileSync(s.file);
      if (buf.length > s.size) {
        process.stdout.write(buf.subarray(s.size).toString("utf8"));
        s.size = buf.length;
      } else if (buf.length < s.size) {
        s.size = buf.length; // file was truncated
      }
    }
  }, 500);
}

function cmdStatus() {
  for (const [name, s] of Object.entries(services)) {
    const pids = pidsOnPort(s.port);
    if (pids.length) {
      console.log(`[${name}] running on :${s.port} (pid ${pids.join(" ")})  ->  http://localhost:${s.port}`);
    } else {
      console.log(`[${name}] not running on :${s.port}`);
    }
  }
}

async function cmdStart() {
  await startOne("server");
  await startOne("client");
  console.log("");
  console.log(`Backend:  http://localhost:${services.server.port}`);
  console.log(`Frontend: http://localhost:${services.client.port}`);
  console.log(`Tail logs: npm run dev:logs`);
}

function cmdStop() {
  stopOne("client"); // client proxies to server, stop it first
  stopOne("server");
}

function usage() {
  console.log(`Local debug launcher for backend + frontend.

Usage: node scripts/dev.mjs <command> [args]

Commands:
  start                 Start backend (:${services.server.port}) and frontend (:${services.client.port}) in background
  stop                  Stop both (identified by listening port)
  restart               Stop then start
  status                Show running status and URLs
  logs [server|client]  Tail logs (default: both)

State files (gitignored):
  .dev/server.pid  .dev/server.log
  .dev/client.pid  .dev/client.log`);
}

const [cmd, arg] = process.argv.slice(2);
switch (cmd) {
  case "start": await cmdStart(); break;
  case "stop": cmdStop(); break;
  case "restart": cmdStop(); await cmdStart(); break;
  case "status": cmdStatus(); break;
  case "logs": {
    const target = arg ?? "all";
    const files =
      target === "server" ? [services.server.logFile]
      : target === "client" ? [services.client.logFile]
      : [services.server.logFile, services.client.logFile];
    tailFollow(files);
    break;
  }
  case undefined:
  case "help":
  case "-h":
  case "--help":
    usage();
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    usage();
    process.exit(1);
}
