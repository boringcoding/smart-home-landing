import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiPort = process.env.PORT ?? '4174';
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) if (!child.killed) child.kill('SIGTERM');
}
function launch(script, args, env) {
  const child = spawn(process.execPath, [script, ...args], { cwd: root, stdio: 'inherit', env });
  children.push(child);
  child.once('error', error => { console.error(error.message); stop(1); });
  child.once('exit', code => { if (!stopping) stop(code ?? 1); });
  return child;
}
launch(path.join(root, 'scripts/server.mjs'), [], { ...process.env, PORT: apiPort, SMART_HOUSE_DEV_ORIGIN: 'http://127.0.0.1:5173' });
launch(path.join(root, 'node_modules/vite/bin/vite.js'), ['--host', '127.0.0.1', '--port', '5173', '--strictPort'], { ...process.env, SMART_HOUSE_API_PORT: apiPort });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop(0));
