import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const commonFiles = [
  'background.js',
  'content.js',
  'logo16.png',
  'logo48.png',
  'logo128.png',
  'onboarding.html',
  'onboarding.js',
  'options.html',
  'options.js',
  'popup.html',
  'privacy.html',
];

const variants = {
  store: {
    manifest: 'manifest.json',
    extraFiles: [],
  },
  advanced: {
    manifest: 'manifests/advanced.json',
    extraFiles: ['sidechat.html', 'sidechat.js', 't3-frame-bootstrap.js', 't3-bridge.js'],
  },
};

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const [name, variant] of Object.entries(variants)) {
  const destination = path.join(dist, name);
  await mkdir(destination, { recursive: true });

  for (const file of [...commonFiles, ...variant.extraFiles]) {
    await cp(path.join(root, file), path.join(destination, file));
  }

  const manifest = JSON.parse(await readFile(path.join(root, variant.manifest), 'utf8'));
  await writeFile(path.join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log('Built dist/store and dist/advanced.');
