# repl-live

Node REPL with automatic context re-require on file change.

You're tinkering with a module at the REPL. You change the source. The REPL doesn't see it. `repl-live` watches the working directory and re-`require()`s your modules into the REPL context on every change, so the next thing you type sees the new code.

## Install

```sh
npm install --save-dev repl-live
```

## Usage

```ts
import { startLive } from 'repl-live';

startLive({
  requires: {
    foo: './foo.cjs',
    bar: './lib/bar.cjs',
  },
});
```

Now at the REPL, `foo` and `bar` are the current exports of those files. Edit the file, hit return, they're the new exports. Both relative paths (resolved against `watchDir`) and absolute paths / node-module names are accepted.

## API

### `startLive(options): REPLServer`

Same shape as `repl.start()` from `node:repl`, plus:

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `requires` | `Record<string, string>` | `{}` | Map from REPL context variable name to module path. |
| `watchDir` | `string` | `process.cwd()` | Directory to watch (recursive). |
| `onReload` | `(event, changedPath?) => void` | `undefined` | Called after a successful reload. `event` is `'initial'` or `'change'`. |
| `onReloadError` | `(err) => void` | logs to stderr | Called when a `require()` throws during reload; the previous context value is retained. |

Returns the underlying `REPLServer`. On the `exit` event the file watcher is closed automatically.

### `attachLiveReload(target, requires, watchDir, onReload?, onReloadError?)`

Lower-level building block. Loads `requires` into `target.context` and watches `watchDir` for changes. Returns an async `dispose()` that closes the watcher. Useful for embedding the reload logic into a host other than `repl.start`.

## Notes

- Re-`require()` works for CommonJS modules. ESM is one-shot in Node (no cache eviction available), so ESM modules will only load once — keep the modules you want to hot-reload as CJS.
- A reload that throws is caught: the previous context value stays in place and the error goes to `onReloadError` (or stderr).
- The file watcher is `chokidar` 4.x, which handles editor-atomic-save quirks across OSes.

## Migration from 0.x

The 0.x API monkey-patched the built-in `repl` module so that `require('repl-live').start(options)` would work as a drop-in for `repl.start`. ESM doesn't allow that. v1 exports `startLive` directly:

```js
// 0.x
const repl = require('repl-live');
repl.start({ requires: { foo: './foo.js' } });

// 1.x
import { startLive } from 'repl-live';
startLive({ requires: { foo: './foo.cjs' } });
```

## Requirements

- Node.js >= 22.

## License

MIT.
