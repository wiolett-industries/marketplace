#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
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

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function workflowPluginRoot() {
  return process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, "..");
}

function hasPluginManifest(root) {
  return fs.existsSync(path.join(root, ".claude-plugin", "plugin.json"));
}

function newestVersionRoot(container) {
  try {
    return fs
      .readdirSync(container, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(container, entry.name))
      .filter(hasPluginManifest)
      .sort()
      .pop() || null;
  } catch {
    return null;
  }
}

function findCompanionPlugin(name) {
  const ownRoot = workflowPluginRoot();
  const candidates = [
    path.join(path.dirname(ownRoot), name),
    path.join(path.dirname(path.dirname(ownRoot)), name),
  ];

  for (const candidate of candidates) {
    if (hasPluginManifest(candidate)) {
      return candidate;
    }

    const versionRoot = newestVersionRoot(candidate);
    if (versionRoot) {
      return versionRoot;
    }
  }

  return null;
}

function hasCompanionPlugin(name) {
  return Boolean(findCompanionPlugin(name));
}

function activeWorkflowSummary(root) {
  const workflowRoot = path.join(root, ".workflow");
  const globalStatePath = path.join(workflowRoot, "state.json");
  const globalState = readJson(globalStatePath);
  const lines = [];

  if (fs.existsSync(workflowRoot)) {
    lines.push("`.workflow/` exists; use artifacts, not chat history.");
  }

  if (globalState?.active_plan) {
    const planPath = path.join(workflowRoot, globalState.active_plan);
    lines.push(`Active workflow plan: .workflow/${globalState.active_plan}`);
    lines.push(`Read: ${path.relative(root, path.join(planPath, "manifest.json"))}, ${path.relative(root, path.join(planPath, "state.json"))}, ${path.relative(root, path.join(planPath, "plan.md"))}.`);
  }

  if (globalState?.active_audit) {
    lines.push(`Active workflow audit: .workflow/${globalState.active_audit}`);
    lines.push("Read audit manifest/state plus prompts, reviews, sanity, and master artifacts.");
  }

  return lines;
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

function agentMemoryContext(root) {
  if (!hasCompanionPlugin("agent-memory")) {
    return [];
  }

  return [
    "Agent Memory installed: at session start and after compaction, load durable context BEFORE your first substantive reply. Do not wait until a memory tool feels needed.",
    "Agent Memory MCP (`memory_*` tools) is the canonical durable store here — it is NOT Claude Code's built-in file memory (`memory/`, `MEMORY.md`). Route all durable user/project facts through `memory_save`/`memory_update`; do not save them into the built-in file memory, and do not treat a built-in-memory read as a substitute for `memory_list`/`memory_recall`.",
    "Memory tools may be deferred: if `memory_list`/`memory_recall` are not already loaded, run ToolSearch for them first, then call `memory_list` for the global index and `memory_recall` on relevant entries. Read `using-agent-memory` for the full protocol.",
    authSummary(),
    projectMemorySummary(root),
    "Before finalizing non-trivial work, save or update durable preferences, repo gotchas, root-cause fixes, and recurring workflows via `memory_save`/`memory_update`.",
    "Never save secrets, raw session summaries, obvious code, temp work, or project facts to global.",
  ];
}

function mergeRequestReviewContext() {
  if (!hasCompanionPlugin("merge-request-review")) {
    return [];
  }

  return [
    "Merge Request Review installed: use `review-merge-request` for GitLab MR protocol review.",
    "External GitLab MCP owns GitLab reads/writes; MR review MCP owns only `.workflow/mr-reviews/` artifacts.",
  ];
}

function sessionContext(input) {
  const root = repoRoot(input.cwd || process.cwd());
  const lines = [
    "Workflow: read `using-workflow` for non-trivial work or context recovery.",
    "Intent Gate is the default first module for non-trivial work; skip only for clearly mechanical low-risk requests.",
    "Flow: intent-gate -> context-discovery -> writing-plans -> executing-plans -> finalizing-plan; partial flows OK.",
    "Use Workflow MCP for `.workflow/` status/create/update/artifact/findings/handoff operations when tools are available.",
    ...activeWorkflowSummary(root),
    ...agentMemoryContext(root),
    ...mergeRequestReviewContext(),
    "Keep `.workflow/` ignored unless explicitly versioned.",
  ];
  writeContext(input.hook_event_name || "SessionStart", lines);
}

function main() {
  try {
    const input = readInput();
    switch (input.hook_event_name) {
      case "SessionStart":
        sessionContext(input);
        break;
      default:
        ok();
    }
  } catch {
    ok();
  }
}

main();
