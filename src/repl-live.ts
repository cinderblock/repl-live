import {
  start as nodeReplStart,
  type ReplOptions,
  type REPLServer,
} from 'node:repl';
import { watch as chokidarWatch, type FSWatcher } from 'chokidar';
import { resolve as resolvePath } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export interface LiveReplOptions extends ReplOptions {
  /** Map of context variable name → module path. These modules are loaded
   *  into the REPL context on startup and re-loaded on any file change in
   *  `watchDir`. Relative paths are resolved against `watchDir`. */
  requires?: Record<string, string>;
  /** Directory to watch for changes. Default: `process.cwd()`. */
  watchDir?: string;
  /** Called whenever the context is reloaded (after the new values are
   *  written into `server.context`). Useful for tests. */
  onReload?: (event: 'initial' | 'change', changedPath?: string) => void;
  /** Called when a reload throws. Default behavior: log to stderr and keep
   *  the previous values in context. */
  onReloadError?: (err: unknown) => void;
}

/** Like `repl.start`, but also watches `watchDir` and re-requires every
 *  module in `requires` whenever anything in the tree changes. */
export function startLive(options: LiveReplOptions = {}): REPLServer {
  const {
    requires = {},
    watchDir = process.cwd(),
    onReload,
    onReloadError,
    ...replOptions
  } = options;

  const server = nodeReplStart(replOptions);
  const handle = attachLiveReload(server, requires, watchDir, onReload, onReloadError);
  server.on('exit', handle.dispose);
  return server;
}

export interface LiveReloadHandle {
  /** Resolves once the file watcher is ready to receive change events.
   *  Tests should await this before mutating files. */
  ready: Promise<void>;
  /** Close the watcher. Idempotent. */
  dispose: () => Promise<void>;
}

/** Lower-level building block. Loads `requires` into `target.context` and
 *  wires up a chokidar watcher that reloads on any change in `watchDir`. */
export function attachLiveReload(
  target: { context: Record<string, unknown>; displayPrompt?: () => void },
  requires: Record<string, string>,
  watchDir: string,
  onReload?: LiveReplOptions['onReload'],
  onReloadError?: LiveReplOptions['onReloadError'],
): LiveReloadHandle {
  // Use createRequire so consumers can still load CJS modules from an ESM caller.
  const requireFn = createRequire(import.meta.url);

  const reload = (event: 'initial' | 'change', changedPath?: string): void => {
    try {
      for (const [key, modulePath] of Object.entries(requires)) {
        const absolute = modulePath.startsWith('.')
          ? resolvePath(watchDir, modulePath)
          : modulePath;
        const resolved = requireFn.resolve(absolute);
        delete requireFn.cache[resolved];
        target.context[key] = requireFn(absolute);
      }
      onReload?.(event, changedPath);
    } catch (err) {
      if (onReloadError) onReloadError(err);
      else process.stderr.write(`[repl-live] reload failed: ${(err as Error).message}\n`);
    }
  };

  reload('initial');

  const watcher: FSWatcher = chokidarWatch(watchDir, { ignoreInitial: true });
  const ready = new Promise<void>(resolveReady => {
    watcher.once('ready', () => resolveReady());
  });
  watcher.on('all', (_event: string, path: string) => {
    reload('change', path);
    target.displayPrompt?.();
  });

  return {
    ready,
    dispose: async () => {
      await watcher.close();
    },
  };
}

export default startLive;

// Re-export from a stable, well-known location for advanced callers.
export const __moduleFileUrl = import.meta.url;
export const __moduleDir = fileURLToPath(new URL('.', import.meta.url));
