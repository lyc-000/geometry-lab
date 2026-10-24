#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Some Windows sandboxes deny esbuild's child process from deleting files in
// the global temp directory. Keeping Vite/esbuild scratch files inside the
// workspace makes dev/build reproducible; this is harmless on unrestricted
// machines too.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = path.join(root, '.tmp');
mkdirSync(scratch, { recursive: true });

const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const env = { ...process.env, TEMP: scratch, TMP: scratch };
const child = spawn(process.execPath, [viteBin, ...process.argv.slice(2)], {
  cwd: root,
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
