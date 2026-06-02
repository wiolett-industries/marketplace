#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const MR_COMPLETION_WORDS =
  /\b(approve|approved|approval|review pass|clean|pass with minors)\b|аппрув|апрув|одобр|чисто|можно approve|можно аппрув/i;

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

function hasVerdict(message, values) {
  const match = message.match(/^Verdict:\s*([A-Z_]+)/im);
  return Boolean(match && values.includes(match[1]));
}

function subagentStart(input) {
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

function validateSubagentStop(input) {
  if (input.stop_hook_active) {
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

function stopGate(input) {
  if (input.stop_hook_active) {
    ok();
    return;
  }

  const message = input.last_assistant_message || "";
  if (!MR_COMPLETION_WORDS.test(message)) {
    ok();
    return;
  }

  const root = repoRoot(input.cwd || process.cwd());
  if (!fs.existsSync(path.join(root, ".workflow", "mr-reviews"))) {
    ok();
    return;
  }

  block("Before MR pass/approval claim, verify discussions, CI/reviewability, and `.workflow/mr-reviews` blockers.");
}

function main() {
  try {
    const input = readInput();
    switch (input.hook_event_name) {
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
