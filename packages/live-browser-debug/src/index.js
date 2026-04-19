#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { createBridgeServer } from './server.js';
import { detectInjectionPlan } from './prepare.js';

const VERSION = '0.1.0';

function asTextResult(payload) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload),
      },
    ],
  };
}

async function main() {
  const bridge = await createBridgeServer({
    host: process.env.LIVE_BROWSER_DEBUG_HOST || '127.0.0.1',
    port: Number.parseInt(process.env.LIVE_BROWSER_DEBUG_PORT || '46777', 10),
  });

  const server = new McpServer(
    {
      name: 'live-browser-debug',
      version: VERSION,
    },
    {
      instructions:
        'Use browser_debug_prepare to get temporary integration instructions for the local frontend app, then attach to the real browser session, record incidents, inspect logs/network/DOM, and clean up the temporary integration after debugging ends.',
    }
  );

  server.registerTool(
    'browser_debug_status',
    {
      title: 'Live Browser Debug Status',
      description: 'Return bridge status, attached sessions, and the active session.',
      inputSchema: z.object({}),
    },
    async () => asTextResult(bridge.state.status())
  );

  server.registerTool(
    'browser_debug_prepare',
    {
      title: 'Prepare Live Browser Debug',
      description:
        'Inspect the current repo and return the recommended temporary integration patch for injecting the live-browser-debug client into the local frontend app.',
      inputSchema: z.object({}),
    },
    async () => {
      const repoRoot = process.cwd();
      return asTextResult({
        repo_root: repoRoot,
        bridge_origin: bridge.bridgeOrigin,
        ws_origin: bridge.wsOrigin,
        prepare: detectInjectionPlan(repoRoot, bridge.wsOrigin),
      });
    }
  );

  server.registerTool(
    'browser_debug_sessions',
    {
      title: 'List Live Browser Debug Sessions',
      description:
        'List attached browser sessions with rich identity metadata so multiple tabs of the same app can be distinguished and labeled.',
      inputSchema: z.object({}),
    },
    async () => asTextResult(bridge.state.listSessions())
  );

  server.registerTool(
    'browser_debug_label_session',
    {
      title: 'Label Live Browser Debug Session',
      description: 'Assign a human-readable label to a browser debug session.',
      inputSchema: z.object({
        session_id: z.string().min(1),
        label: z.string().min(1),
      }),
    },
    async ({ session_id, label }) => asTextResult(bridge.state.labelSession(session_id, label))
  );

  server.registerTool(
    'browser_debug_attach',
    {
      title: 'Attach Live Browser Debug Session',
      description: 'Mark one live browser debug session as the active target for later reads and recordings.',
      inputSchema: z.object({
        session_id: z.string().min(1),
      }),
    },
    async ({ session_id }) => asTextResult(bridge.state.attach(session_id))
  );

  server.registerTool(
    'browser_debug_start_recording',
    {
      title: 'Start Live Browser Debug Recording',
      description: 'Start active recording on a browser session for a bounded time window.',
      inputSchema: z.object({
        session_id: z.string().optional(),
        duration_ms: z.number().int().min(1000).max(300000).optional(),
      }),
    },
    async ({ session_id, duration_ms }) =>
      asTextResult(bridge.state.startRecording(session_id, { durationMs: duration_ms, mode: 'recording' }))
  );

  server.registerTool(
    'browser_debug_stop_recording',
    {
      title: 'Stop Live Browser Debug Recording',
      description: 'Stop active recording on a browser session.',
      inputSchema: z.object({
        session_id: z.string().optional(),
      }),
    },
    async ({ session_id }) => asTextResult(bridge.state.stopRecording(session_id))
  );

  server.registerTool(
    'browser_debug_watch_for_redirect',
    {
      title: 'Watch For Redirect',
      description:
        'Start redirect-focused recording on a browser session and stop automatically when a redirect-like navigation event is observed.',
      inputSchema: z.object({
        session_id: z.string().optional(),
        duration_ms: z.number().int().min(1000).max(300000).optional(),
      }),
    },
    async ({ session_id, duration_ms }) =>
      asTextResult(
        bridge.state.startRecording(session_id, {
          durationMs: duration_ms,
          mode: 'redirect-watch',
          stopAfterRedirect: true,
        })
      )
  );

  server.registerTool(
    'browser_debug_get_recording_summary',
    {
      title: 'Get Recording Summary',
      description: 'Return a concise summary of the current session timeline, errors, suspicious requests, and redirect target if present.',
      inputSchema: z.object({
        session_id: z.string().optional(),
      }),
    },
    async ({ session_id }) => asTextResult(bridge.state.getRecordingSummary(session_id))
  );

  server.registerTool(
    'browser_debug_get_timeline',
    {
      title: 'Get Timeline',
      description: 'Return the ordered event timeline for a browser debug session.',
      inputSchema: z.object({
        session_id: z.string().optional(),
        limit: z.number().int().min(1).max(5000).optional(),
      }),
    },
    async ({ session_id, limit }) => asTextResult(bridge.state.getTimeline(session_id, { limit }))
  );

  server.registerTool(
    'browser_debug_get_logs',
    {
      title: 'Get Browser Logs',
      description: 'Return console logs and error events for a browser debug session.',
      inputSchema: z.object({
        session_id: z.string().optional(),
        limit: z.number().int().min(1).max(5000).optional(),
      }),
    },
    async ({ session_id, limit }) => asTextResult(bridge.state.getLogs(session_id, { limit }))
  );

  server.registerTool(
    'browser_debug_get_network',
    {
      title: 'Get Browser Network Timeline',
      description: 'Return captured network events and bodies for a browser debug session.',
      inputSchema: z.object({
        session_id: z.string().optional(),
        limit: z.number().int().min(1).max(5000).optional(),
      }),
    },
    async ({ session_id, limit }) => asTextResult(bridge.state.getNetwork(session_id, { limit }))
  );

  server.registerTool(
    'browser_debug_get_dom_snapshot',
    {
      title: 'Get DOM Snapshot',
      description: 'Return the nearest DOM or state snapshot for a browser debug session.',
      inputSchema: z.object({
        session_id: z.string().optional(),
        snapshot_id: z.string().optional(),
        at_event_id: z.string().optional(),
        at_timestamp: z.string().optional(),
      }),
    },
    async ({ session_id, snapshot_id, at_event_id, at_timestamp }) =>
      asTextResult(bridge.state.getDomSnapshot(session_id, { snapshotId: snapshot_id, atEventId: at_event_id, atTimestamp: at_timestamp }))
  );

  server.registerTool(
    'browser_debug_get_visual_snapshot',
    {
      title: 'Get Visual Snapshot',
      description: 'Return the nearest best-effort approximate visual snapshot for a browser debug session.',
      inputSchema: z.object({
        session_id: z.string().optional(),
        snapshot_id: z.string().optional(),
        at_event_id: z.string().optional(),
        at_timestamp: z.string().optional(),
      }),
    },
    async ({ session_id, snapshot_id, at_event_id, at_timestamp }) =>
      asTextResult(bridge.state.getVisualSnapshot(session_id, { snapshotId: snapshot_id, atEventId: at_event_id, atTimestamp: at_timestamp }))
  );

  server.registerTool(
    'browser_debug_cleanup',
    {
      title: 'Live Browser Debug Cleanup',
      description: 'Return current session status and remind the caller to remove the temporary integration patch from the app.',
      inputSchema: z.object({}),
    },
    async () => asTextResult(bridge.state.cleanupStatus())
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error in live-browser-debug MCP server:', error);
  process.exitCode = 1;
});
