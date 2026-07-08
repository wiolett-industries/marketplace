# Security Policy

## Reporting

Please do not open public issues for suspected vulnerabilities.

Report security concerns privately to:

- [contact@wiolett.net](mailto:contact@wiolett.net)

Include enough detail to reproduce or assess the issue:

- affected plugin, package, version, commit, or install path
- impact and expected attacker capability
- reproduction steps or proof-of-concept details
- relevant logs, tool output, or screenshots

We will acknowledge the report as soon as practical and coordinate follow-up
privately before public disclosure.

## Scope

Security reports are especially useful for:

- secret or credential exposure
- unsafe MCP tool behavior
- path traversal or unintended filesystem writes
- command execution or shell injection
- unsafe plugin install, hook, or agent-sync behavior
- model-provider auth handling issues

Non-security bugs, documentation issues, and feature requests should use the
regular issue template instead.

## Supported Versions

This repository is developed from `main`. Security fixes are normally released
by updating the affected package/plugin version and publishing the current
marketplace state.

When reporting, include the exact commit or published version you tested.
