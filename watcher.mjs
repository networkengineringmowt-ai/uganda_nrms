// watcher.mjs — auto-commit/push watcher for the Uganda NRMS platform.
// Watches the project, debounces, then `git add -A && git commit && git push
// origin main`. GitHub Actions (.github/workflows/deploy.yml) does the actual
// Vite build + gh-pages deploy — this watcher no longer builds locally.
//
//   node watcher.mjs            (foreground)
//   npm run watch               (same)
//   start-watcher.ps1           (background + log tail)
//
// Every change/commit/push is appended to uganda-roads-watcher.log.
import chokidar from 'chokidar';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.join(ROOT, 'uganda-roads-watcher.log');
const DEBOUNCE_MS = 4000;          // give editors time to finish saving batches
const BRANCH = 'main';

// Optional Drive data sources synced into public/data before each commit.
const DATA_SOURCES = [path.join(ROOT, '..', 'data'), path.join(ROOT, '..', 'assets')];
const PUBLIC_DATA = path.join(ROOT, 'public', 'data');

const WATCH = ['src', 'public', 'index.html', 'vite.config.ts', 'package.json', 'tsconfig.json',
  'tsconfig.app.json', 'tsconfig.node.json'].map(p => path.join(ROOT, p));
const IGNORE = [/node_modules/, /[/\\]dist/, /\.git/, /\.log$/, /uganda-roads-watcher/];

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(LOG, line); } catch { /* ignore */ }
}

function run(cmd, args) {
  return new Promise(resolve => {
    const p = spawn(cmd, args, { cwd: ROOT, shell: true });
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { out += d; });
    p.on('close', code => resolve({ code, out }));
    p.on('error', e => resolve({ code: 1, out: String(e) }));
  });
}

// Copy any newer data files from ../data / ../assets into public/data.
function syncDriveData() {
  let copied = 0;
  for (const srcDir of DATA_SOURCES) {
    if (!fs.existsSync(srcDir)) continue;
    fs.mkdirSync(PUBLIC_DATA, { recursive: true });
    for (const f of fs.readdirSync(srcDir)) {
      if (!/\.(geojson|json|csv|xlsx)$/i.test(f)) continue;
      const s = path.join(srcDir, f), d = path.join(PUBLIC_DATA, f);
      try {
        if (!fs.existsSync(d) || fs.statSync(s).mtimeMs > fs.statSync(d).mtimeMs) {
          fs.copyFileSync(s, d); copied++;
        }
      } catch { /* ignore individual file */ }
    }
  }
  if (copied) log(`Synced ${copied} data file(s) into public/data from Drive sources.`);
}

let pushing = false, pending = false, timer = null;

async function commitAndPush() {
  if (pushing) { pending = true; return; }          // coalesce overlapping triggers
  pushing = true;
  try {
    syncDriveData();

    // Anything to commit?
    const status = await run('git', ['status', '--porcelain']);
    if (!status.out.trim()) { log('No changes to commit — skipping.'); return; }

    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    log('CHANGES STAGED — git add -A');
    await run('git', ['add', '-A']);

    const c = await run('git', ['commit', '-m', `auto: ${stamp}`]);
    if (c.code !== 0) {
      log(`COMMIT FAILED (exit ${c.code}) — ${c.out.split('\n').slice(-6).join(' | ').slice(0, 800)}`);
      return;
    }
    log(`COMMITTED "auto: ${stamp}" — pushing to origin/${BRANCH}…`);

    const p = await run('git', ['push', 'origin', BRANCH]);
    log(p.code === 0
      ? 'PUSH SUCCESS — GitHub Actions will build + deploy. Watch the Actions tab.'
      : `PUSH FAILED (exit ${p.code}) — ${p.out.split('\n').slice(-6).join(' | ').slice(0, 800)}`);
  } finally {
    pushing = false;
    if (pending) { pending = false; trigger('queued change'); }
  }
}

function trigger(reason) {
  if (timer) clearTimeout(timer);
  log(`CHANGE DETECTED (${reason}) — debouncing ${DEBOUNCE_MS}ms…`);
  timer = setTimeout(() => { timer = null; void commitAndPush(); }, DEBOUNCE_MS);
}

const watcher = chokidar.watch(WATCH, {
  ignored: IGNORE, ignoreInitial: true, persistent: true,
  awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
});
watcher
  .on('add', p => trigger(`add ${path.relative(ROOT, p)}`))
  .on('change', p => trigger(`change ${path.relative(ROOT, p)}`))
  .on('unlink', p => trigger(`remove ${path.relative(ROOT, p)}`))
  .on('ready', () => log(`Watcher started (commit+push mode). Watching: ${WATCH.map(p => path.relative(ROOT, p) || '.').join(', ')}`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { log('Watcher stopped.'); watcher.close().finally(() => process.exit(0)); });
}
