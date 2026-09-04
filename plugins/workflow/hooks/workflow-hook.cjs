#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");

function readInput() {
  const raw = fs.readFileSync(0, "utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function isKimiHost() {
  return Boolean(process.env.KIMI_PLUGIN_ROOT);
}

function writeContext(eventName, lines) {
  if (isKimiHost()) {
    process.stdout.write(lines.filter(Boolean).join("\n"));
    return;
  }
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
  if (isKimiHost()) {
    return;
  }
  console.log(JSON.stringify({ continue: true }));
}

function block(reason) {
  if (isKimiHost()) {
    process.stderr.write(`${reason}\n`);
    process.exitCode = 2;
    return;
  }
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

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function agentsHome() {
  return process.env.PROJECT_MEMORY_AGENTS_HOME || process.env.AGENTS_HOME || path.join(os.homedir(), ".agents");
}

function mcpConfigPath() {
  return path.join(process.env.WIOLETT_CONFIG_DIR || path.join(agentsHome(), ".wiolett", "config"), "mcp-config.yml");
}

function readYamlScalar(keys, configPath = mcpConfigPath()) {
  let source;
  try {
    source = fs.readFileSync(configPath, "utf8");
  } catch {
    return null;
  }
  const stack = [];
  for (const rawLine of source.split(/\r?\n/u)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    const match = rawLine.match(/^(\s*)([^:#][^:]*):(?:\s*(.*))?$/u);
    if (!match) continue;
    const indent = match[1].length;
    const key = match[2].trim().replace(/^["']|["']$/gu, "");
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    stack.push({ indent, key });
    const value = stripYamlComment(match[3] || "").trim();
    const currentKeys = stack.map((item) => item.key);
    if (currentKeys.join(".") === keys.join(".")) return parseYamlScalarValue(value);
    if (value.startsWith("{") && isPathPrefix(currentKeys, keys)) {
      const nested = readFlowScalar(value, keys.slice(currentKeys.length));
      if (nested !== null) return nested;
    }
  }
  return null;
}

function isPathPrefix(prefix, value) {
  return prefix.length < value.length && prefix.every((key, index) => value[index] === key);
}

function parseYamlScalarValue(value) {
  const normalized = value.trim();
  if (!normalized || normalized === "null" || normalized === "~") return null;
  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    try { return JSON.parse(normalized); } catch { return normalized.slice(1, -1); }
  }
  if (normalized.startsWith("'") && normalized.endsWith("'")) return normalized.slice(1, -1).replace(/''/gu, "'");
  return normalized;
}

function readFlowScalar(source, keys) {
  let current = source;
  for (const key of keys) {
    const mapping = parseFlowMapping(current);
    if (!mapping || !mapping.has(key)) return null;
    current = mapping.get(key);
  }
  return parseYamlScalarValue(current);
}

function parseFlowMapping(source) {
  const normalized = source.trim();
  if (!normalized.startsWith("{") || !normalized.endsWith("}")) return null;
  const mapping = new Map();
  for (const entry of splitFlow(normalized.slice(1, -1), ",")) {
    const pair = splitFlow(entry, ":", 2);
    if (pair.length !== 2) return null;
    const key = pair[0].trim().replace(/^["']|["']$/gu, "");
    mapping.set(key, pair[1].trim());
  }
  return mapping;
}

function splitFlow(source, separator, limit = Infinity) {
  const parts = [];
  let start = 0;
  let braces = 0;
  let brackets = 0;
  let single = false;
  let double = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "'" && !double) single = !single;
    else if (char === '"' && !single && source[index - 1] !== "\\") double = !double;
    else if (!single && !double) {
      if (char === "{") braces += 1;
      else if (char === "}") braces -= 1;
      else if (char === "[") brackets += 1;
      else if (char === "]") brackets -= 1;
      else if (char === separator && braces === 0 && brackets === 0 && parts.length < limit - 1) {
        parts.push(source.slice(start, index));
        start = index + 1;
      }
    }
  }
  parts.push(source.slice(start));
  return parts;
}

function stripYamlComment(value) {
  let single = false;
  let double = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "'" && !double) single = !single;
    else if (char === '"' && !single && value[index - 1] !== "\\") double = !double;
    else if (char === "#" && !single && !double && (index === 0 || /\s/u.test(value[index - 1]))) return value.slice(0, index);
  }
  return value;
}

function resolveConfiguredRoot(workspaceRoot, keys, fallback) {
  const configured = readYamlScalar(keys) || fallback;
  const expanded = configured === "~" ? os.homedir() : configured.startsWith("~/") ? path.join(os.homedir(), configured.slice(2)) : configured;
  return path.resolve(path.isAbsolute(expanded) ? expanded : path.join(workspaceRoot, expanded));
}

function workflowArtifactRoot(root) {
  return resolveConfiguredRoot(root, ["mcp", "workflow", "artifacts", "root"], ".workflow");
}

function reviewArtifactRoot(root) {
  return resolveConfiguredRoot(root, ["mcp", "merge-request-review", "artifacts", "root"], ".workflow/mr-reviews");
}

function projectMemoryRoot(root) {
  return resolveConfiguredRoot(root, ["mcp", "agent-memory", "storage", "memory", "project"], ".memory");
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
  const workflowRoot = workflowArtifactRoot(root);
  const globalStatePath = path.join(workflowRoot, "state.json");
  const globalState = readJson(globalStatePath);
  const lines = [];

  if (fs.existsSync(workflowRoot)) {
    lines.push(`Workflow artifacts exist at \`${path.relative(root, workflowRoot) || "."}/\`; use artifacts, not chat history.`);
  }

  if (globalState?.active_plan) {
    const planPath = path.join(workflowRoot, globalState.active_plan);
    lines.push(`Active workflow plan: ${path.relative(root, path.join(workflowRoot, globalState.active_plan))}`);
    lines.push(`Read: ${path.relative(root, path.join(planPath, "manifest.json"))}, ${path.relative(root, path.join(planPath, "state.json"))}, ${path.relative(root, path.join(planPath, "plan.md"))}.`);
    lines.push("Before final output for completed work, call `workflow_plan_complete`; a phase update does not clear `active_plan`.");
  }

  if (globalState?.active_audit) {
    lines.push(`Active workflow audit: ${path.relative(root, path.join(workflowRoot, globalState.active_audit))}`);
    lines.push("Read audit manifest/state plus prompts, reviews, sanity, and master artifacts.");
    lines.push("Before final output for a completed audit, call `workflow_audit_complete`; a phase update does not clear `active_audit`.");
  }

  return lines;
}

function authSummary() {
  const providersFile = path.join(process.env.WIOLETT_CONFIG_DIR || path.join(agentsHome(), ".wiolett", "config"), "ai-providers.yml");
  const gateProvider = readYamlScalar(["mcp", "agent-memory", "routing", "gate", "provider"]) || "openai";
  const gateCredential = readYamlScalar(["providers", gateProvider, "auth", "api_key"], providersFile);
  if (gateCredential) {
    return "Agent Memory gate auth: configured.";
  }
  return "Agent Memory gate auth missing: run `npx -y @wiolett/agent-memory@latest init`.";
}

function projectMemorySummary(root) {
  const memoryRoot = projectMemoryRoot(root);
  if (fs.existsSync(memoryRoot)) {
    return `Project Agent Memory \`${path.relative(root, memoryRoot) || "."}/\` exists; proactively use \`memory_query\` for a focused question or \`memory_recap\` for broad recovery when durable repo context can affect non-trivial work.`;
  }
  return "No project `.memory/`: reads no-op; writes may init only for durable saves.";
}

function projectMemoryReconciliationReminder(root) {
  const record = readJson(path.join(projectMemoryRoot(root), "maintenance", "reconciliation.json"));
  const lastReconciledAt = record?.last_reconciled_at;
  const timestamp = typeof lastReconciledAt === "string" ? Date.parse(lastReconciledAt) : Number.NaN;
  const ageDays = Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
  if (!Number.isFinite(timestamp) || ageDays < 30) return null;
  return `Project Agent Memory reconciliation is overdue (${ageDays} days since ${lastReconciledAt}). For recurring or multi-memory work, offer the user a reconciliation; use \`memory_reconciliation_status\` and \`reconciling-memory\` only after approval. Do not record or mutate memory automatically.`;
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
    projectMemoryReconciliationReminder(root),
    "Before final output for completed non-trivial work, run the memory completion latch: save or update a real reusable lesson when one emerged; never save raw progress, transcripts, or secrets.",
  ];
}

function mergeRequestReviewContext(root) {
  if (!hasCompanionPlugin("merge-request-review")) {
    return [];
  }

  const lines = [
    "Merge Request Review installed: use `review-merge-request` only for an actual ready GitLab MR; do not also use `finalizing-plan` for that review.",
    `The MR review MCP owns only \`${path.relative(root, reviewArtifactRoot(root)) || "."}/\` artifacts and does not access GitLab itself. For an actual MR review, use any separately configured and authorized GitLab interface available in the environment, such as an external GitLab MCP or authenticated \`glab\`; this does not restrict GitLab CLI usage outside MR reviews.`,
  ];
  const reviewState = readJson(path.join(reviewArtifactRoot(root), "state.json"));
  if (reviewState?.active_review) {
    lines.push(`Active merge request review: ${path.relative(root, path.join(reviewArtifactRoot(root), reviewState.active_review.replace(/^mr-reviews\//u, "")))}`);
    lines.push("After the clean note and external GitLab approval succeed, call `mr_review_complete`; changing phase alone does not clear `active_review`.");
  }
  return lines;
}

function sessionContext(input) {
  const root = repoRoot(input.cwd || process.cwd());
  if (input.source === "compact") {
    writeContext("SessionStart", compactRecoveryContext());
    return;
  }
  const lines = [
    "Workflow: read `using-workflow`, choose one primary path (direct, plan-execute, audit, or GitLab review), and load only the current module.",
    "A triggered skill does not imply an artifact, subagent, plan, review loop, or fresh budget.",
    "Run `intent-gate` locally for non-trivial work and keep it silent when intent is clear.",
    "Context budget is a hard gate: a new plan, resume, compaction, or hand-off never authorizes project inventory; start from the named surface and widen only for one named dependency.",
    "Minimum-solution gate: every plan item must trace to requested behavior, an observed failure, or a concrete normal-path risk. Minimal means behavior-complete: never omit accepted behavior, normal flow, integrity/security, or compatibility. Cut hypothetical edge cases, future-proofing, repeated-crash scenarios, and unrelated refactors.",
    "UI reuse gate: before JSX/CSS, record a reuse receipt with the exact fields `Target:`, `Shared primitive:`, `Layout precedent:`, `Decision:`, and `Structural verification:`. A named shared component is architecture acceptance, not visual guidance.",
    "UI composition gate: shared-components-only forbids local substitutes, wrappers, tokens, and parallel layouts. Reuse/adapt the named primitive and analogous composition or ask; behavior tests and screenshots alone do not prove reuse.",
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

function compactRecoveryContext() {
  return [
    "Compaction recovery is not a discovery reset: preserve the current task scope and read budget.",
    "Do not re-run repository discovery, root-doc or manifest scans, project-wide file listings, or broad memory recovery. Use the compacted task summary first.",
    "Open only a named source, directly affected test, or referenced artifact needed for the next action. If a material decision is missing, ask or name the exact gap; do not scan to reconstruct it.",
  ];

}

function validateStopGates(input) {
  if (input.stop_hook_active) {
    ok();
    return;
  }

  const root = repoRoot(input.cwd || process.cwd());
  const workflowRoot = workflowArtifactRoot(root);
  const globalState = readJson(path.join(workflowRoot, "state.json"));
  const activePlan = globalState?.active_plan;
  const planState = activePlan ? readJson(path.join(workflowRoot, activePlan, "state.json")) : null;

  const reflection = planState?.commitment_reflection;

  if (reflection?.required === true && reflection.status === "pending") {
    const hasProposal = Boolean(reflection.proposal);
    block(
      hasProposal
        ? "Before presenting or executing this material plan, perform the bounded shrink-first reflection returned by `workflow_plan_commitment_propose`, then call `workflow_plan_commitment_confirm`. Work locally from the existing context without another repository discovery pass."
        : "This material plan still needs its bounded commitment reflection. Call `workflow_plan_commitment_propose`, review the candidate by trying to remove unsupported scope, then call `workflow_plan_commitment_confirm`. Work locally from the existing context without another repository discovery pass."
    );
    return;
  }

  if (reflection?.required === true && reflection.status === "replan_required") {
    block("Replace the rejected candidate with a narrower plan, then run one new propose/confirm commitment reflection. Keep the pass local and omit architecture polish.");
    return;
  }

  const uiReason = validateUiReuseEvidence(input, workflowRoot, activePlan, planState);
  if (uiReason) {
    block(uiReason);
    return;
  }

  ok();
}

function containsUiFile(source) {
  return /(?:^|[\s`(])[^\s`()]+\.(?:tsx|jsx|vue|svelte|css|scss|sass|less)(?=\W|$)/imu.test(source);
}

function hasUiChangedFile(message) {
  const changedFilesIndex = message.search(/^Changed files:/im);
  if (changedFilesIndex >= 0) {
    const remainder = message.slice(changedFilesIndex).replace(/^Changed files:[^\S\r\n]*/i, "");
    const nextSection = remainder.search(/^(?:Verification|Concerns|UI Reuse Evidence):/im);
    const changedFiles = nextSection >= 0 ? remainder.slice(0, nextSection) : remainder;
    if (containsUiFile(changedFiles)) return true;
  }

  return /^(?:[-*]\s*)?(?:(?:I|We)\s+)?(?:implemented|changed|edited|updated|modified|created|added|removed|fixed)\b[^\n]*\.(?:tsx|jsx|vue|svelte|css|scss|sass|less)(?=\W|$)/imu.test(message);
}

function missingReuseReceiptField(source) {
  const fields = [
    ["Target", /^Target:\s*\S+/im],
    ["Shared primitive", /^Shared primitive:\s*\S+/im],
    ["Layout precedent", /^Layout precedent:\s*\S+/im],
    ["Decision", /^Decision:\s*(?:reuse|adapt|none)\s*$/im],
    ["Structural verification", /^Structural verification:\s*\S+/im],
  ];
  return fields.find(([, pattern]) => !pattern.test(source))?.[0] || null;
}

function hasPassingStructuralEvidence(source) {
  return /^Structural verification:\s*PASS\b.*(?:lint|ast|import|wiring|static|architecture|code check|symbol)/im.test(source);
}

function validateUiReuseEvidence(input, workflowRoot, activePlan, planState) {
  const message = input.last_assistant_message || "";
  const reportsUiChanges = hasUiChangedFile(message);
  if (reportsUiChanges) {
    if (!/^UI Reuse Evidence:\s*$/im.test(message)) {
      return "UI files are reported as changed, but final output lacks `UI Reuse Evidence:`. Provide Target, Shared primitive, Layout precedent, Decision, and Structural verification with PASS evidence.";
    }
    const missing = missingReuseReceiptField(message);
    if (missing) return `UI reuse evidence is missing \`${missing}:\`.`;
    if (!hasPassingStructuralEvidence(message)) {
      return "UI completion requires `Structural verification: PASS ...` with lint, AST/import, wiring, static, architecture, or focused code-check evidence; behavior tests/screenshots alone do not prove reuse.";
    }
  }

  // An incomplete active UI contract belongs to the plan, not to every chat
  // turn. Only enforce it when this response actually reports UI changes.
  if (!activePlan || !reportsUiChanges) return null;
  const contract = readText(path.join(workflowRoot, activePlan, "ui-contract.md"));
  if (!contract || /No UI contract applies unless frontend or visible UI work is in scope\./i.test(contract)) return null;

  if (!/^## UI Reuse Receipt\s*$/im.test(contract)) {
    return "The active UI contract lacks `## UI Reuse Receipt`; record it before continuing UI implementation.";
  }
  const missing = missingReuseReceiptField(contract);
  if (missing) return `The active UI reuse receipt is missing \`${missing}:\`.`;
  if (["finalizing", "complete"].includes(planState?.phase) && !hasPassingStructuralEvidence(contract)) {
    return "Finalizing UI work requires `Structural verification: PASS ...` with static import/wiring evidence in `ui-contract.md`.";
  }
  return null;
}

function subagentStart(input) {
  const agentType = input.agent_type || "";
  const lines = [
    `Workflow agent ${agentType}: assigned artifacts/scope are source of truth.`,
    "RO=no edits. Write=assigned worktree/scope only.",
    "No scope creep, lint suppression, or unsupported assumptions.",
    "Context hard gate: the assigned scope or question is a read boundary. Do not inventory or re-read the project after a plan or compaction; if an outside file is essential, name the exact dependency and report `NEEDS_CONTEXT`.",
    "Minimum-solution gate: implement assigned behavior completely; do not add hypothetical hardening or omit acceptance, normal flow, integrity/security, or compatibility to reduce scope.",
    "UI reuse gate: before coding, require a receipt with the exact fields `Target:`, `Shared primitive:`, `Layout precedent:`, `Decision:`, and `Structural verification:`. A named reuse instruction is architecture acceptance.",
    "UI composition gate: shared-components-only means no local substitute or wrapper; use the named primitive and analogous layout or report `NEEDS_CONTEXT`. Behavior tests/screenshots alone do not prove reuse.",
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

  if (agentType.startsWith("workflow_implementer")) {
    const hasStatus = /^Status:\s*(DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT)\s*$/im.test(message);
    const hasChangedFiles = /^Changed files:/im.test(message);
    const hasVerification = /^Verification:/im.test(message);
    if (!hasStatus || !hasChangedFiles || !hasVerification) {
      block("Need `Status: DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT`, `Changed files:`, `Verification:`.");
      return;
    }
    if (hasUiChangedFile(message)) {
      if (!/^UI Reuse Evidence:\s*$/im.test(message)) {
        block("UI implementer output needs `UI Reuse Evidence:` with Target, Shared primitive, Layout precedent, Decision, and Structural verification.");
        return;
      }
      const missing = missingReuseReceiptField(message);
      if (missing || !hasPassingStructuralEvidence(message)) {
        block(missing ? `UI reuse evidence is missing \`${missing}:\`.` : "UI implementer completion requires `Structural verification: PASS ...` with static import/wiring evidence.");
        return;
      }
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
        ok();
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
        validateStopGates(input);
        break;
      default:
        ok();
    }
  } catch {
    ok();
  }
}

main();
