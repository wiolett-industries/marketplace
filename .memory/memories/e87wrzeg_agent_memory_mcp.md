---
{
  "id": "e87wrzeg",
  "file_name": "e87wrzeg_agent_memory_mcp",
  "tags": [
    "async-context",
    "git-boundary",
    "mcp",
    "memory-pattern",
    "test-coverage",
    "verification",
    "workspace_root"
  ],
  "layer": "deep",
  "ref": null,
  "created_at": 1783546481971,
  "updated_at": 1783546481971
}
---
In agent-marketplace-next, MCP false-empty memory_list results can originate from MCP server cwd drift or index-only semantics. The durable fix pattern is: resolve project memory using an absolute workspace_root; utilize AsyncLocalStorage to propagate per-call project root context across async handlers; stop ancestor discovery at the nearest .git boundary; and keep memory_list({ index_only: true }) as lite/index-only while default memory_list includes both deep and lite entries. Regression coverage should exercise canonical memory_list after MCP writes, reads with incorrect cwd when using workspace_root, rejection of relative workspace_root, same-repo child-cwd discovery, nested repository boundary isolation, and alignment of skill/README/tool metadata.
