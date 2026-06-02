#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const FINAL_WORDS =
  /\b(done|fixed|complete|completed|implemented|pushed|committed)\b|готово|сделал|починил|исправил|завершил|закоммитил|запушил/i;
const COMMIT_PUSH_WORDS = /\b(pushed|committed)\b|закоммитил|запушил/i;

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

function sessionContext(input) {
  const root = repoRoot(input.cwd || process.cwd());
  const lines = [
    "Workflow: read `using-workflow` for non-trivial work or context recovery.",
    "Flow: intent-gate -> context-discovery -> writing-plans -> executing-plans -> finalizing-plan; partial flows OK.",
    ...activeWorkflowSummary(root),
    "Keep `.workflow/` ignored unless explicitly versioned.",
  ];
  writeContext(input.hook_event_name || "SessionStart", lines);
}

function postCompactContext(input) {
  const root = repoRoot(input.cwd || process.cwd());
  const lines = [
    "PostCompact workflow: read `using-workflow`; restore from artifacts + git, not chat.",
    ...activeWorkflowSummary(root),
    "Plans: read manifest/state/plan/context/decisions/questions/relevant artifacts.",
    "Audits: read scope/state/prompts/reviews/sanity/master artifacts.",
  ];
  writeContext("PostCompact", lines);
}

function subagentStart(input) {
  const agentType = input.agent_type || "";
  const lines = [
    `Workflow agent ${agentType}: assigned artifacts/scope are source of truth.`,
    "RO=no edits. Write=assigned worktree/scope only.",
    "No scope creep, lint suppression, or unsupported assumptions.",
  ];

  if (agentType === "workflow_implementer") {
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

function planStateIsFinal(planState) {
  const value = String(planState?.phase || planState?.status || "").toLowerCase();
  return ["complete", "completed", "finalized", "closed", "done"].includes(value);
}

function stagedWorkflowFiles(root) {
  const staged = execGit(root, ["diff", "--cached", "--name-only"]);
  return staged
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line === ".workflow" || line.startsWith(".workflow/"));
}

function stopGate(input) {
  if (input.stop_hook_active) {
    ok();
    return;
  }

  const message = input.last_assistant_message || "";
  if (!FINAL_WORDS.test(message)) {
    ok();
    return;
  }

  const root = repoRoot(input.cwd || process.cwd());
  const stagedWorkflow = stagedWorkflowFiles(root);
  if (stagedWorkflow.length > 0) {
    block("`.workflow/` is staged. Unstage unless explicitly versioned.");
    return;
  }

  const workflowState = readJson(path.join(root, ".workflow", "state.json"));
  if (workflowState?.active_plan) {
    const planState = readJson(path.join(root, ".workflow", workflowState.active_plan, "state.json"));
    if (!planStateIsFinal(planState)) {
      block("Active workflow plan is not finalized. Finalize it or report open state.");
      return;
    }
  }

  const dirty = execGit(root, ["status", "--short"]);
  if (dirty && COMMIT_PUSH_WORDS.test(message)) {
    block("Commit/push claimed but worktree is dirty. Inspect `git status --short` and correct handoff.");
    return;
  }

  ok();
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
        subagentStart(input);
        break;
      case "SubagentStop":
        validateSubagentStop(input);
        break;
      case "Stop":
        stopGate(input);
        break;
      default:
        ok();
    }
  } catch {
    ok();
  }
}

main();
