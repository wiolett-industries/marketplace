---
{
  "id": "btpyl4q2",
  "file_name": "btpyl4q2_marketplace_verification_pnpm",
  "tags": [
    "agent-marketplace-next",
    "pnpm",
    "setup",
    "verification",
    "workflow"
  ],
  "layer": "deep",
  "ref": null,
  "created_at": 1783286986477,
  "updated_at": 1783286986477
}
---
In this repository, run pnpm verification using the user’s login shell so the project-pinned pnpm 9.15.0 is used: zsh -lic 'pnpm test', zsh -lic 'pnpm typecheck', and similar. The Codex runtime PATH can expose a different plain pnpm (observed 11.7.0), which may trigger lockfile/overrides mismatch and broken workspace node_modules behavior. If package-local node_modules links look broken, first run zsh -lic 'pnpm i'; it should restore dependencies without lockfile churn when the lockfile is already current.
