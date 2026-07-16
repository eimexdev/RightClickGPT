import { access, readFile, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);

for (const variant of ['store', 'advanced']) {
  const directory = path.join(root, 'dist', variant);
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const files = await readdir(directory);

  assert(manifest.manifest_version === 3, `${variant}: Manifest V3 is required.`);
  assert(!JSON.stringify(manifest).includes('<all_urls>'), `${variant}: <all_urls> is forbidden.`);
  assert(!files.some((file) => file.startsWith('.')), `${variant}: hidden files must not be packaged.`);

  const referencedFiles = [
    manifest.action?.default_popup,
    manifest.background?.service_worker,
    manifest.options_page,
    manifest.side_panel?.default_path,
    ...Object.values(manifest.icons || {}),
    ...(manifest.content_scripts || []).flatMap((entry) => entry.js || []),
  ].filter(Boolean);

  for (const file of referencedFiles) {
    await access(path.join(directory, file));
  }

  if (variant === 'store') {
    assert(!manifest.permissions.includes('sidePanel'), 'store: sidePanel permission is forbidden.');
    assert(!manifest.permissions.some((permission) => permission.startsWith('declarativeNetRequest')), 'store: DNR permissions are forbidden.');
    assert(!files.includes('t3-bridge.js'), 'store: the T3 session bridge must not ship.');
    assert(!files.includes('t3-frame-bootstrap.js'), 'store: the T3 frame bootstrap must not ship.');
    assert(!files.includes('sidechat.html'), 'store: embedded sidechat must not ship.');
  }
}

for (const file of ['background.js', 'content.js', 'onboarding.js', 'options.js', 'sidechat.js', 't3-frame-bootstrap.js', 't3-bridge.js']) {
  const source = await readFile(path.join(root, file), 'utf8');
  assert(!/\beval\s*\(/.test(source), `${file}: eval is forbidden.`);
  assert(!/new\s+Function\s*\(/.test(source), `${file}: Function constructor is forbidden.`);
  assert(!/<script[^>]+src=["']https?:/i.test(source), `${file}: remote scripts are forbidden.`);
  await execFileAsync(process.execPath, ['--check', path.join(root, file)]);
}

for (const file of ['onboarding.html', 'options.html', 'popup.html', 'privacy.html', 'sidechat.html']) {
  const source = await readFile(path.join(root, file), 'utf8');
  assert(!/<script[^>]+src=["']https?:/i.test(source), `${file}: remote scripts are forbidden.`);
}

console.log('Store and advanced packages satisfy launch invariants.');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
