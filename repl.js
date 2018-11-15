const repl = require('./repl-live.js');

repl.start({ requires: { foobar: './foobar.js' } });
