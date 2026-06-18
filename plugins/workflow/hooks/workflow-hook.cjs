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
      continue: true,
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

function block(reason) {
  console.log(JSON.stringify({ decision: "block", reason }));
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
  return process.env.PLUGIN_ROOT || path.resolve(__dirname, "..");
}

function hasPluginManifest(root) {
  return fs.existsSync(path.join(root, ".codex-plugin", "plugin.json"));
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
    "Agent Memory installed: read `using-agent-memory` before memory tools.",
    authSummary(),
    projectMemorySummary(root),
    "Finalizing durable work: save/update reusable preferences, repo gotchas, root-cause fixes, and recurring workflows.",
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

function postCompactContext() {
  ok();
}

function subagentStart(input) {
  const agentType = input.agent_type || "";
  const lines = [
    `Workflow agent ${agentType}: assigned artifacts/scope are source of truth.`,
    "RO=no edits. Write=assigned worktree/scope only.",
    "No scope creep, lint suppression, or unsupported assumptions.",
  ];

  if (agentType === "workflow_implementer") {
    lines.push("Spark implementer is for bounded code patches only: no open-ended analysis, architecture discovery, or broad refactors.");
    lines.push("Output: `Status: DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT`, `Changed files:`, `Verification:`, `Concerns:`.");
  } else if (agentType === "workflow_fix_triage") {
    lines.push("Output starts with `Verdict: FIX_TASKS | NO_ACTION`.");
  } else if (agentType.includes("audit")) {
    lines.push("Output includes `Verdict:` per agent instructions.");
  } else if (agentType.includes("reviewer")) {
    lines.push("Output includes `Verdict: CLEAN | LOW_ONLY | FINDINGS | BLOCKED` unless agent instructions narrow it.");
  } else if (agentType === "workflow_intent_reviewer") {
    lines.push("Output includes `Intent:`, `Confidence:`, `Complexity:`, `Recommended workflow path:`.");
  }

  writeContext("SubagentStart", lines);
}

function mergeRequestSubagentStart(input) {
  if (!hasCompanionPlugin("merge-request-review")) {
    ok();
    return;
  }

  const agentType = input.agent_type || "";
  const lines = [
    `MR review agent ${agentType}: read current MR discussions/diff/CI + .workflow/mr-reviews first.`,
    "No GitLab writes/approval/resolution unless parent delegates.",
    "Never approve over blockers, stale state, or missing current verification.",
  ];

  if (agentType === "merge_request_discussion_auditor") {
    lines.push("Output: current blocker state, threads to verify, preserved context, can review?");
  } else if (agentType === "merge_request_verification_reviewer") {
    lines.push("Output: `Reviewability: REVIEWABLE | BLOCKED`, evidence, weak/missing verification, blockers, next step.");
  } else {
    lines.push("Output includes `Scope Check:` and `Verdict: REVIEW_BLOCKED|REVIEW_FAIL|REVIEW_PASS_WITH_MINORS|REVIEW_PASS`.");
  }

  writeContext("SubagentStart", lines);
}

function hasVerdict(message, values) {
  const match = message.match(/^Verdict:\s*([A-Z_]+)/im);
  return Boolean(match && values.includes(match[1]));
}

function validateSubagentStop(input) {
  if (input.stop_hook_active) {
    ok();
    return;
  }

  const agentType = input.agent_type || "";
  const message = input.last_assistant_message || "";

  if (!message.trim()) {
    block("Return structured workflow output with required Status/Verdict.");
    return;
  }

  if (agentType === "workflow_implementer") {
    const hasStatus = /^Status:\s*(DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT)\s*$/im.test(message);
    const hasChangedFiles = /^Changed files:/im.test(message);
    const hasVerification = /^Verification:/im.test(message);
    if (!hasStatus || !hasChangedFiles || !hasVerification) {
      block("Need `Status: DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT`, `Changed files:`, `Verification:`.");
      return;
    }
  } else if (agentType === "workflow_fix_triage") {
    if (!hasVerdict(message, ["FIX_TASKS", "NO_ACTION"])) {
      block("Need `Verdict: FIX_TASKS | NO_ACTION`.");
      return;
    }
  } else if (agentType === "workflow_audit_reviewer") {
    if (!hasVerdict(message, ["CLEAN", "FINDINGS", "BLOCKED"])) {
      block("Need `Verdict: CLEAN | FINDINGS | BLOCKED`.");
      return;
    }
  } else if (agentType === "workflow_audit_sanity_reviewer") {
    if (!hasVerdict(message, ["CLEAN", "REVISE", "BLOCKED"])) {
      block("Need `Verdict: CLEAN | REVISE | BLOCKED`.");
      return;
    }
  } else if (agentType.includes("reviewer")) {
    if (!hasVerdict(message, ["CLEAN", "LOW_ONLY", "FINDINGS", "BLOCKED"])) {
      block("Need `Verdict: CLEAN | LOW_ONLY | FINDINGS | BLOCKED`.");
      return;
    }
  }

  ok();
}

function validateMergeRequestSubagentStop(input) {
  if (!hasCompanionPlugin("merge-request-review") || input.stop_hook_active) {
    ok();
    return;
  }

  const agentType = input.agent_type || "";
  const message = input.last_assistant_message || "";
  if (!message.trim()) {
    block("Return structured MR review output.");
    return;
  }

  if (agentType === "merge_request_verification_reviewer") {
    if (!/^Reviewability:\s*(REVIEWABLE|BLOCKED)\s*$/im.test(message)) {
      block("Need `Reviewability: REVIEWABLE | BLOCKED`.");
      return;
    }
  } else if (agentType === "merge_request_discussion_auditor") {
    if (!/current blocker state/i.test(message) && !/blocker state/i.test(message)) {
      block("Need current blocker state.");
      return;
    }
  } else {
    if (!/^Scope Check:\s*(PASS|FAIL)\b/im.test(message)) {
      block("Need `Scope Check: PASS | FAIL`.");
      return;
    }
    if (!hasVerdict(message, ["REVIEW_BLOCKED", "REVIEW_FAIL", "REVIEW_PASS_WITH_MINORS", "REVIEW_PASS"])) {
      block("Need `Verdict: REVIEW_BLOCKED | REVIEW_FAIL | REVIEW_PASS_WITH_MINORS | REVIEW_PASS`.");
      return;
    }
  }

  ok();
}

function isWorkflowAgent(input) {
  return (input.agent_type || "").startsWith("workflow_");
}

function isMergeRequestAgent(input) {
  return (input.agent_type || "").startsWith("merge_request_");
}

function main() {
  try {
    const input = readInput();
    switch (input.hook_event_name) {
      case "SessionStart":
        sessionContext(input);
        break;
      case "PostCompact":
        postCompactContext(input);
        break;
      case "SubagentStart":
        if (isWorkflowAgent(input)) {
          subagentStart(input);
        } else if (isMergeRequestAgent(input)) {
          mergeRequestSubagentStart(input);
        } else {
          ok();
        }
        break;
      case "SubagentStop":
        if (isWorkflowAgent(input)) {
          validateSubagentStop(input);
        } else if (isMergeRequestAgent(input)) {
          validateMergeRequestSubagentStop(input);
        } else {
          ok();
        }
        break;
      default:
        ok();
    }
  } catch {
    ok();
  }
}

main();
