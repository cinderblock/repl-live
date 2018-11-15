const repl = require('repl');
const watch = require('watch');

const oldstart = repl.start;

repl.start = function start(options) {
  const requires = options.requires || {};

  const replServer = oldstart(options);
  const watchDir = process.cwd();

  console.log('Watching:', watchDir);

  watch.watchTree(watchDir, () => {
    const keys = Object.keys(requires);
    console.log();
    console.log('Reloading:', keys);
    keys.forEach(k => {
      const path = requires[k][0] == '.' ? watchDir + '/' + requires[k] : requires[k];
      delete require.cache[require.resolve(path)];
      replServer.context[k] = require(path);
    });
    process.stdout.write(options.prompt || (typeof options == 'string' ? options : '> '));
  });

  replServer.on('exit', () => {
    watch.unwatchTree(watchDir);
  });

  return replServer;
};

module.exports = repl;
