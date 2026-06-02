#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const cp = require("child_process");

function readInput() {
  const raw = fs.readFileSync(0, "utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function writeContext(eventName, lines) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: eventName,
        additionalContext: lines.filter(Boolean).join("\n"),
      },
    }),
  );
}

function ok() {
  console.log(JSON.stringify({ continue: true }));
}

function execGit(cwd, args) {
  try {
    return cp.execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function repoRoot(cwd) {
  return execGit(cwd, ["rev-parse", "--show-toplevel"]) || cwd;
}

function authSummary() {
  const authFile = path.join(os.homedir(), ".agents", ".wiolett", "auth-config.json");
  if (process.env.OPENAI_API_KEY || fs.existsSync(authFile)) {
    return "Agent Memory auth: configured.";
  }
  return "Agent Memory auth missing for gated writes/embeddings: run `npx -y @wiolett/agent-memory@latest init`.";
}

function projectMemorySummary(root) {
  if (fs.existsSync(path.join(root, ".memory"))) {
    return "Project `.memory/` exists; focused reads OK after repo boundary.";
  }
  return "No project `.memory/`: reads no-op; writes may init only for durable saves.";
}

function main() {
  try {
    const input = readInput();
    const root = repoRoot(input.cwd || process.cwd());
    const commonLines = [
      "Agent Memory: read `using-agent-memory` before memory tools.",
      authSummary(),
      projectMemorySummary(root),
      "Never save secrets, session summaries, obvious code, temp work, or project facts to global.",
    ];

    if (input.hook_event_name === "PostCompact") {
      writeContext("PostCompact", [
        commonLines[0],
        "PostCompact: global lite -> relevant recall; project after repo; recover `.workflow`; not chat.",
        ...commonLines.slice(1),
      ]);
      return;
    }

    writeContext(input.hook_event_name || "SessionStart", [
      commonLines[0],
      "Start: global lite -> relevant recall; project reads after repo boundary.",
      ...commonLines.slice(1),
    ]);
  } catch {
    ok();
  }
}

main();
