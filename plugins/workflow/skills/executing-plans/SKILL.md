---
name: Executing Plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

## Overview

Load plan, review critically, execute all tasks, run the right review loop, and report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note:** This workflow works much better with access to subagents. If Codex multi-agent support is available, use `subagent-driven-development` instead of this skill.

If the `multi-agent-workflows` plugin is installed and the plan is substantial but not tightly coupled, activate `Using Multi-Agent Workflows` instead of defaulting to this skill.

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: create a plan tracker and proceed

### Step 2: Execute Tasks

For each task:
1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Run `Review Change` in `task` mode after each meaningful task or batch
5. Mark as completed

### Step 3: Hand Off for Branch Completion

After all tasks complete and verified:
- Run `Review Change` in `feature` mode by default
- Use `Review Change` in `high-risk` mode instead when the change is risky, breaking, or codebase-wide
- Summarize what was implemented
- Report the verification you ran and its results
- Ask the user how they want to finish the branch:
  - merge locally
  - open a PR
  - keep the branch as-is
  - discard the work

Do not perform branch cleanup, merge, deletion, or PR creation unless the user explicitly asks for it.

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent

## Integration

**Required workflow skills:**
- **using-git-worktrees** - REQUIRED: Set up isolated workspace before starting
- **writing-plans** - Creates the plan this skill executes
- **review-change** - Review each meaningful task or batch and run the final gated review
