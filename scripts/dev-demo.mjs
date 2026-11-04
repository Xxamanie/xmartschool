import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const backend = fileURLToPath(new URL('../backend/', import.meta.url));
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill();
}

function start(name, args, cwd) {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit' });
  children.push(child);
  child.on('error', error => {
    console.error(`${name} could not start: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`${name} stopped (${signal || code}).`);
      stop(code || 1);
    }
  });
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
console.log('Starting the demo frontend and API. Press Ctrl+C to stop both.');
start('Backend API', ['--import', 'tsx', 'src/server.ts'], backend);
start('Frontend', ['node_modules/vite/bin/vite.js', '--port', '3000', '--strictPort'], root);
