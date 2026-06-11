import { watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { resetMemoryReady } from '../runtime.js';
import type { MemoryScope } from '../scope.js';

const DEBOUNCE_MS = 250;

/** True for the disposable SQLite cache files (basename starts with memory.db). */
function isCacheFile(filename: string): boolean {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  return base.startsWith('memory.db');
}

/**
 * Pushes Server-Sent `change` events to connected clients when the watched
 * `.memory` directory mutates, and drops the rebuilt-cache flag so the next read
 * re-ingests files from disk. Single recursive watcher (Node >= 20 supports it on
 * darwin and linux). All resources are released by `close()` so a harness/CLI
 * process can exit cleanly.
 */
export class ChangeHub {
  private readonly clients = new Set<ServerResponse>();
  private watcher: FSWatcher | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly memoryDir: string, private readonly scope: MemoryScope) {}

  start(): void {
    if (this.watcher) return;
    try {
      this.watcher = watch(this.memoryDir, { recursive: true }, (_event, filename) => {
        // Ignore our own SQLite cache writes (memory.db, -wal, -shm, -journal).
        // The DB lives inside .memory, so WAL writes on every read would otherwise
        // feed back as change events and loop the dashboard endlessly.
        if (filename && isCacheFile(filename)) return;
        this.schedule();
      });
    } catch {
      // Watching is best-effort; the UI still works with manual refresh.
      this.watcher = null;
    }
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      resetMemoryReady(this.scope);
      this.broadcast();
    }, DEBOUNCE_MS);
  }

  addClient(res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 2000\n\n');
    this.clients.add(res);
    res.on('close', () => this.clients.delete(res));
  }

  private broadcast(): void {
    for (const res of this.clients) {
      res.write(`event: change\ndata: {"scope":"${this.scope}"}\n\n`);
    }
  }

  async close(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    for (const res of this.clients) {
      res.end();
    }
    this.clients.clear();
  }
}
