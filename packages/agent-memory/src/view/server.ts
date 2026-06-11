import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getMemoryRoot } from '../scope.js';
import type { MemoryScope } from '../scope.js';
import type { GraphDirection } from '../graph.js';
import type { PathStrategy } from '../tools/path.js';
import {
  getGraphPayload,
  getHealth,
  getMemoryDetail,
  getMemoryList,
  getMeta,
  getScatter,
  getScopes,
  runPath,
  runQuery,
  runSearch,
} from './api.js';
import { serveStatic } from './static.js';
import { ChangeHub } from './watch.js';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 7077;
const MAX_PORT_PROBES = 40;

/** Read the package version once so /api/meta never drifts from package.json. */
function packageVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    return (require('../../package.json') as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
const DEFAULT_VERSION = packageVersion();

export interface ViewServerOptions {
  scope?: MemoryScope;
  port?: number;
  version?: string;
}

export interface ViewServerHandle {
  port: number;
  url: string;
  close: () => Promise<void>;
}

/** Resolve dist/ui relative to the compiled dist/view/server.js location. */
function resolveUiDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', 'ui');
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(body);
}

/**
 * Serialize DB-touching handlers. The underlying sqlite cache is a single
 * path-keyed connection; an async handler suspended at `await embed()` must not
 * let a different-scope request swap the open DB mid-flight (plan correction C13).
 */
class RequestQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T> | T): Promise<T> {
    const result = this.tail.then(() => task());
    this.tail = result.catch(() => undefined);
    return result;
  }
}

function parseScope(url: URL, fallback: MemoryScope): MemoryScope {
  return url.searchParams.get('scope') === 'global' ? 'global' : url.searchParams.get('scope') === 'project' ? 'project' : fallback;
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  defaultScope: MemoryScope,
  version: string,
): Promise<void> {
  const scope = parseScope(url, defaultScope);
  const route = url.pathname;

  if (route === '/api/meta') return sendJson(res, 200, getMeta(version, scope));
  if (route === '/api/scopes') return sendJson(res, 200, getScopes());
  if (route === '/api/graph') return sendJson(res, 200, getGraphPayload(scope));
  if (route === '/api/list') return sendJson(res, 200, getMemoryList(scope));
  if (route === '/api/health') return sendJson(res, 200, getHealth(scope));
  if (route === '/api/scatter') return sendJson(res, 200, getScatter(scope));

  if (route.startsWith('/api/memory/')) {
    const id = decodeURIComponent(route.slice('/api/memory/'.length));
    const detail = getMemoryDetail(id, scope);
    return detail === null ? sendJson(res, 404, { error: 'not found', id }) : sendJson(res, 200, detail);
  }

  if (route === '/api/search') {
    const query = url.searchParams.get('q') ?? '';
    const limit = Number(url.searchParams.get('limit') ?? '10') || 10;
    return sendJson(res, 200, await runSearch(query, limit, scope));
  }

  if (route === '/api/query') {
    const query = url.searchParams.get('q') ?? '';
    const expand = url.searchParams.get('expand') !== 'false';
    const hops = Number(url.searchParams.get('hops') ?? '1') || 1;
    const detail = (url.searchParams.get('detail') as 'brief' | 'normal' | 'full' | null) ?? 'normal';
    return sendJson(res, 200, await runQuery({ query, scope, expand, expand_hops: hops, detail }));
  }

  if (route === '/api/path') {
    const from = url.searchParams.get('from') ?? '';
    const to = url.searchParams.get('to') ?? '';
    const strategy = (url.searchParams.get('strategy') as PathStrategy | null) ?? 'shortest';
    const direction = (url.searchParams.get('direction') as GraphDirection | null) ?? 'both';
    return sendJson(res, 200, runPath({ from_id: from, to_id: to, scope, strategy, direction }));
  }

  sendJson(res, 404, { error: 'unknown endpoint', route });
}

function listen(server: Server, startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let port = startPort;
    let attempts = 0;

    const tryListen = (): void => {
      server.listen(port, HOST);
    };

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' && attempts < MAX_PORT_PROBES) {
        attempts += 1;
        port += 1;
        tryListen();
        return;
      }
      reject(error);
    });

    server.on('listening', () => {
      const address = server.address() as AddressInfo | null;
      resolve(address?.port ?? port);
    });
    tryListen();
  });
}

/**
 * Boot the read-only view server bound to loopback. Resolves AFTER the socket is
 * bound so callers can print the real port. `close()` tears down the http server,
 * the fs watcher, and any open SSE streams so the process can exit (plan C3).
 */
export async function startViewServer(options: ViewServerOptions = {}): Promise<ViewServerHandle> {
  const scope: MemoryScope = options.scope ?? 'project';
  const version = options.version ?? DEFAULT_VERSION;
  const uiDir = resolveUiDir();
  const memoryDir = getMemoryRoot(scope);

  const hub = new ChangeHub(memoryDir, scope);
  hub.start();
  const queue = new RequestQueue();

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${HOST}`);

    if (url.pathname === '/api/events') {
      hub.addClient(res);
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      queue
        .run(() => handleApi(req, res, url, scope, version))
        .catch((error) => {
          if (!res.headersSent) {
            sendJson(res, 500, { error: error instanceof Error ? error.message : 'internal error' });
          }
        });
      return;
    }

    serveStatic(req, res, uiDir);
  });

  const port = await listen(server, options.port ?? DEFAULT_PORT);

  return {
    port,
    url: `http://${HOST}:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        void hub.close();
        // SSE keep-alive sockets would otherwise hold server.close() open until the
        // browser times out; force them shut so Ctrl+C exits immediately.
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
