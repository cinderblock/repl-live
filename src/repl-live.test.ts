import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { attachLiveReload } from './repl-live.js';

/** Wait for a predicate to become true, polling at 50 ms intervals. */
async function waitUntil(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('waitUntil timed out');
}

describe('attachLiveReload', () => {
  it('loads requires into target.context on startup', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'repl-live-test-'));
    try {
      await writeFile(join(dir, 'foo.cjs'), "module.exports = 'first';\n");
      const ctx: Record<string, unknown> = {};
      const target = { context: ctx };
      const handle = attachLiveReload(target, { foo: './foo.cjs' }, dir);
      try {
        await handle.ready;
        assert.equal(ctx.foo, 'first');
      } finally {
        await handle.dispose();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('re-loads requires when a file changes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'repl-live-test-'));
    try {
      const fooPath = join(dir, 'foo.cjs');
      await writeFile(fooPath, "module.exports = 'v1';\n");
      const ctx: Record<string, unknown> = {};
      let reloads = 0;
      const target = { context: ctx, displayPrompt: () => {} };
      const handle = attachLiveReload(
        target,
        { foo: './foo.cjs' },
        dir,
        event => {
          if (event === 'change') reloads++;
        },
      );
      try {
        await handle.ready;
        assert.equal(ctx.foo, 'v1');
        // Mutate the file and wait for the watcher to notice.
        await writeFile(fooPath, "module.exports = 'v2';\n");
        await waitUntil(() => reloads >= 1 && ctx.foo === 'v2', 10000);
        assert.equal(ctx.foo, 'v2');
      } finally {
        await handle.dispose();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('calls onReloadError on a broken reload and keeps prior context', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'repl-live-test-'));
    try {
      const fooPath = join(dir, 'foo.cjs');
      await writeFile(fooPath, "module.exports = 'good';\n");
      const ctx: Record<string, unknown> = {};
      const errors: unknown[] = [];
      const target = { context: ctx, displayPrompt: () => {} };
      const handle = attachLiveReload(
        target,
        { foo: './foo.cjs' },
        dir,
        undefined,
        err => errors.push(err),
      );
      try {
        await handle.ready;
        assert.equal(ctx.foo, 'good');
        // Write something that will throw at require time.
        await writeFile(fooPath, 'throw new Error("boom");\n');
        await waitUntil(() => errors.length >= 1, 10000);
        assert.equal(ctx.foo, 'good', 'context should retain last good value');
        assert.match((errors[0] as Error).message, /boom/);
      } finally {
        await handle.dispose();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
