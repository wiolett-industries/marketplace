#!/usr/bin/env node

// PostToolUse output filter for Bash. Trims noisy stdout BEFORE it enters the
// model context, driven by ~/.agents/.wiolett/output.json. Conservative by
// design: stderr and exit codes are never touched, large output is elided with
// error/warning lines preserved, and on ANY uncertainty it passes the original
// output through unchanged.

const fs = require("fs");
const os = require("os");
const path = require("path");

// Claude Code caps hook output near 10000 chars; stay safely under it.
const HOOK_OUTPUT_CAP = 9500;

function passthrough() {
  // Emit nothing: the original tool output is preserved.
  process.exit(0);
}

function loadConfig() {
  const defaults = {
    enabled: true,
    maxBashChars: 9000,
    headChars: 3000,
    tailChars: 3000,
    stripAnsi: true,
    collapseRepeats: true,
    repeatThreshold: 3,
    keepLinesMatching: "error|fail|warn|✕|✗|exception|traceback|fatal|panic",
    rules: [],
  };
  try {
    const file = path.join(os.homedir(), ".agents", ".wiolett", "output.json");
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return { ...defaults, ...(raw && typeof raw === "object" ? raw : {}) };
  } catch {
    return defaults;
  }
}

// Real terminal control only: every pattern requires the ESC byte, so plain
// bracketed text (git "[main abc]", markdown "[x]", "[INFO]") is never touched.
function stripAnsi(text) {
  return text
    .replace(/\r\n/g, "\n") // normalize CRLF
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "") // OSC sequences
    .replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, "") // CSI sequences (colors, cursor)
    .replace(/\x1b[@-Z\\-_]/g, "") // other single-char escapes
    .replace(/[^\n\r]*\r/g, ""); // collapse carriage-return progress overwrites
}

function collapseRepeats(text, threshold) {
  const lines = text.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    let j = i + 1;
    while (j < lines.length && lines[j] === lines[i]) j++;
    const run = j - i;
    out.push(lines[i]);
    if (run >= threshold) {
      out.push(`… (previous line repeated ${run - 1} more times)`);
    }
    i = j;
  }
  return out.join("\n");
}

function matchRule(command, rules) {
  if (!Array.isArray(rules)) return null;
  for (const rule of rules) {
    if (!rule || !rule.match) continue;
    try {
      if (new RegExp(rule.match).test(command)) return rule;
    } catch {
      // ignore bad pattern
    }
  }
  return null;
}

function keepTail(text, keepLines) {
  const lines = text.split("\n");
  if (lines.length <= keepLines) return text;
  const dropped = lines.length - keepLines;
  return `… [${dropped} earlier lines elided] …\n` + lines.slice(-keepLines).join("\n");
}

function elide(text, cfg) {
  const head = text.slice(0, cfg.headChars);
  const tail = text.slice(text.length - cfg.tailChars);
  const middle = text.slice(cfg.headChars, text.length - cfg.tailChars);

  let kept = [];
  if (cfg.keepLinesMatching) {
    try {
      const re = new RegExp(cfg.keepLinesMatching, "i");
      kept = middle.split("\n").filter((line) => re.test(line)).slice(0, 20);
    } catch {
      // ignore bad pattern
    }
  }

  let marker = `\n… [${middle.length} chars elided`;
  if (kept.length) marker += `; ${kept.length} notable line(s) kept`;
  marker += "] …\n";

  let out = head + marker;
  if (kept.length) out += kept.join("\n") + "\n… [end kept lines] …\n";
  return out + tail;
}

function hardCap(text) {
  if (text.length <= HOOK_OUTPUT_CAP) return text;
  const head = Math.floor(HOOK_OUTPUT_CAP * 0.6);
  const tail = HOOK_OUTPUT_CAP - head - 48;
  return text.slice(0, head) + "\n… [truncated to fit hook limit] …\n" + text.slice(text.length - tail);
}

function locateText(result) {
  if (typeof result === "string") return { kind: "string" };
  if (result && typeof result === "object") {
    for (const key of ["stdout", "output", "stdoutText", "text"]) {
      if (typeof result[key] === "string") return { kind: "object", key };
    }
  }
  return null;
}

function emit(updated) {
  const payload = JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      updatedToolOutput: updated,
    },
  });
  if (payload.length > HOOK_OUTPUT_CAP + 600) return false;
  process.stdout.write(payload);
  return true;
}

function main() {
  let input;
  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    input = raw ? JSON.parse(raw) : {};
  } catch {
    return passthrough();
  }

  if ((input.tool_name || "") !== "Bash") return passthrough();

  const cfg = loadConfig();
  if (!cfg.enabled) return passthrough();

  const result = input.tool_output !== undefined ? input.tool_output : input.tool_response;
  const loc = locateText(result);
  if (!loc) return passthrough();

  const command = (input.tool_input && input.tool_input.command) || "";
  const rule = matchRule(command, cfg.rules);
  if (rule && rule.mode === "passthrough") return passthrough();

  const original = loc.kind === "string" ? result : result[loc.key];
  let text = original;

  if (cfg.stripAnsi) text = stripAnsi(text);
  if (cfg.collapseRepeats) text = collapseRepeats(text, cfg.repeatThreshold || 3);
  if (rule && rule.mode === "tail") text = keepTail(text, rule.keepLines || 40);

  let elided = false;
  if (text.length > cfg.maxBashChars) {
    text = elide(text, cfg);
    elided = true;
  }

  if (text === original) return passthrough();

  const build = (t) => (loc.kind === "string" ? t : { ...result, [loc.key]: t });

  if (emit(build(text))) return;

  // Payload too large for the hook limit.
  if (elided) {
    if (emit(build(hardCap(text)))) return;
  }
  // Respect the user's threshold / avoid a truncated replacement: show original.
  return passthrough();
}

try {
  main();
} catch {
  passthrough();
}
