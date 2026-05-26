// Minimal demo: run `node examples/repl.mjs` from the repo root and edit
// examples/foobar.cjs while the REPL is open. The `foobar` binding will
// update on every save.
import { startLive } from '../dist/repl-live.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

startLive({
  watchDir: here,
  requires: {
    foobar: resolve(here, 'foobar.cjs'),
  },
});
