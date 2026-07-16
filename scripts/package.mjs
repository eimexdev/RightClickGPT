import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const manifest = JSON.parse(await readFile(path.join(dist, 'store', 'manifest.json'), 'utf8'));

for (const variant of ['store', 'advanced']) {
  const output = path.join(dist, `rightclickgpt-${variant}-${manifest.version}.zip`);
  await rm(output, { force: true });
  await execFileAsync('zip', ['-q', '-r', output, '.'], {
    cwd: path.join(dist, variant),
  });
  await execFileAsync('unzip', ['-t', output]);
  console.log(`Created ${path.relative(root, output)}.`);
}
