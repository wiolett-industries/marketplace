import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

function contentType(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Serve a built SPA from `uiDir`. Unknown non-asset routes fall back to
 * index.html (client-side routing). Path traversal is blocked by resolving the
 * request against `uiDir` and rejecting anything that escapes the prefix.
 */
export function serveStatic(req: IncomingMessage, res: ServerResponse, uiDir: string): void {
  if (!existsSync(uiDir)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('UI bundle missing. Run `pnpm build` to emit dist/ui.');
    return;
  }

  const rawPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const relative = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
  const resolved = path.resolve(uiDir, relative);

  // Reject traversal outside the UI directory.
  if (resolved !== uiDir && !resolved.startsWith(uiDir + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  const target = existsSync(resolved) && statSync(resolved).isFile()
    ? resolved
    : path.join(uiDir, 'index.html');

  if (!existsSync(target)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, { 'Content-Type': contentType(target), 'Cache-Control': 'no-cache' });
  createReadStream(target)
    .on('error', () => res.end())
    .pipe(res);
}
