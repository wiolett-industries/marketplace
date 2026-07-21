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
  return process.env.PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, "..");
}

function hasPluginManifest(root) {
  return fs.existsSync(path.join(root, ".codex-plugin", "plugin.json")) || fs.existsSync(path.join(root, ".claude-plugin", "plugin.json"));
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
    lines.push("Before final output for completed work, call `workflow_plan_complete`; a phase update does not clear `active_plan`.");
  }

  if (globalState?.active_audit) {
    lines.push(`Active workflow audit: .workflow/${globalState.active_audit}`);
    lines.push("Read audit manifest/state plus prompts, reviews, sanity, and master artifacts.");
    lines.push("Before final output for a completed audit, call `workflow_audit_complete`; a phase update does not clear `active_audit`.");
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
    return "Project Agent Memory `.memory/` exists; proactively use `memory_query` for a focused question or `memory_recap` for broad recovery when durable repo context can affect non-trivial work.";
  }
  return "No project `.memory/`: reads no-op; writes may init only for durable saves.";
}

function agentMemoryContext(root) {
  if (!hasCompanionPlugin("agent-memory")) {
    return [];
  }

  return [
    "Agent Memory MCP installed: read `using-agent-memory`; choose one task-appropriate `memory_query` or `memory_recap` without waiting for an explicit memory request when durable context can change non-trivial work.",
    "Agent Memory writes are state changes; read-only/no-edits work does not write memory unless remembering is explicitly requested.",
    authSummary(),
    projectMemorySummary(root),
    "Before final output for completed non-trivial work, run the memory completion latch: save or update a real reusable lesson when one emerged; never save raw progress, transcripts, or secrets.",
  ];
}

function mergeRequestReviewContext(root) {
  if (!hasCompanionPlugin("merge-request-review")) {
    return [];
  }

  const lines = [
    "Merge Request Review installed: use `review-merge-request` only for an actual ready GitLab MR; do not also use `finalizing-plan` for that review.",
    "External GitLab MCP owns GitLab reads/writes; MR review MCP owns only `.workflow/mr-reviews/` artifacts.",
  ];
  const reviewState = readJson(path.join(root, ".workflow", "mr-reviews", "state.json"));
  if (reviewState?.active_review) {
    lines.push(`Active merge request review: .workflow/${reviewState.active_review}`);
    lines.push("After the clean note and external GitLab approval succeed, call `mr_review_complete`; changing phase alone does not clear `active_review`.");
  }
  return lines;
}

function sessionContext(input) {
  const root = repoRoot(input.cwd || process.cwd());
  const lines = [
    "Workflow: read `using-workflow`, choose one primary path (direct, plan-execute, audit, or GitLab review), and load only the current module.",
    "A triggered skill does not imply an artifact, subagent, plan, review loop, or fresh budget.",
    "Run `intent-gate` locally for non-trivial work and keep it silent when intent is clear.",
    "Task-wide ceilings: fast (0 agents), standard (at most 1 total), assurance (declared total, default 3; at most 2 reviewers per round), or an explicit audit budget.",
    "Authorization is permission, not activation. Parent Max/Ultra and multiple skills do not expand the budget.",
    "Run each verification once per unchanged diff and stop when acceptance, required evidence, and material-risk gates pass.",
    "Use `workflow-mcp` only for authorized `.workflow/` operations; manual state/artifact writes are fallback only.",
    ...activeWorkflowSummary(root),
    ...agentMemoryContext(root),
    ...mergeRequestReviewContext(root),
    "Read-only/no-edits work does not write code, `.workflow/`, memory, or external state unless the same request explicitly authorizes it.",
    "Keep `.workflow/` ignored unless explicitly versioned.",
  ];
  writeContext(input.hook_event_name || "SessionStart", lines);
}

function postCompactContext() {
  ok();
}

function stopCommitmentReflection(input) {
  if (input.stop_hook_active) {
    ok();
    return;
  }

  const root = repoRoot(input.cwd || process.cwd());
  const globalState = readJson(path.join(root, ".workflow", "state.json"));
  if (!globalState?.active_plan) {
    ok();
    return;
  }

  const planState = readJson(path.join(root, ".workflow", globalState.active_plan, "state.json"));
  const reflection = planState?.commitment_reflection;
  if (!reflection || reflection.required !== true) {
    ok();
    return;
  }

  if (reflection.status === "pending") {
    const hasProposal = Boolean(reflection.proposal);
    block(
      hasProposal
        ? "Before presenting or executing this material plan, perform the bounded shrink-first reflection returned by `workflow_plan_commitment_propose`, then call `workflow_plan_commitment_confirm`. Work locally from the existing context without another repository discovery pass."
        : "This material plan still needs its bounded commitment reflection. Call `workflow_plan_commitment_propose`, review the candidate by trying to remove unsupported scope, then call `workflow_plan_commitment_confirm`. Work locally from the existing context without another repository discovery pass."
    );
    return;
  }

  if (reflection.status === "replan_required") {
    block("Replace the rejected candidate with a narrower plan, then run one new propose/confirm commitment reflection. Keep the pass local and omit architecture polish.");
    return;
  }

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
    lines.push("Lightweight implementer is for bounded code patches only: no open-ended analysis, architecture discovery, or broad refactors.");
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
      case "Stop":
        stopCommitmentReflection(input);
        break;
      default:
        ok();
    }
  } catch {
    ok();
  }
}

main();
