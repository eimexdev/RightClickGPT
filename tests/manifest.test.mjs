import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const store = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
const advanced = JSON.parse(await readFile(new URL('../manifests/advanced.json', import.meta.url), 'utf8'));
const background = await readFile(new URL('../background.js', import.meta.url), 'utf8');
const sidechat = await readFile(new URL('../sidechat.js', import.meta.url), 'utf8');

test('store manifest uses only provider host permissions', () => {
  assert.deepEqual(store.host_permissions, [
    'https://chatgpt.com/*',
    'https://chat.openai.com/*',
    'https://t3.chat/*',
  ]);
  assert.equal(JSON.stringify(store).includes('<all_urls>'), false);
});

test('store manifest excludes invasive advanced capabilities', () => {
  assert.deepEqual(store.permissions, ['contextMenus', 'storage', 'alarms']);
  assert.equal(store.permissions.includes('sidePanel'), false);
  assert.equal(store.permissions.some((permission) => permission.startsWith('declarativeNetRequest')), false);
  assert.equal(store.content_scripts.some((entry) => entry.js.includes('t3-bridge.js')), false);
});

test('advanced manifest keeps exact host scope', () => {
  assert.deepEqual(advanced.host_permissions, store.host_permissions);
  assert.equal(JSON.stringify(advanced).includes('<all_urls>'), false);
  assert.equal(advanced.content_scripts.some((entry) => entry.world === 'MAIN'), false);
  assert.equal(advanced.content_scripts.some((entry) => entry.js.includes('t3-frame-bootstrap.js')), true);
});

test('pending prompt retention has expiry and tab-close cleanup', () => {
  assert.match(background, /chrome\.alarms\.create/);
  assert.match(background, /chrome\.alarms\.onAlarm\.addListener/);
  assert.match(background, /chrome\.tabs\.onRemoved\.addListener/);
});

test('advanced sidechat keeps prompt-bearing state in memory', () => {
  assert.match(background, /chrome\.storage\.session\.set\(\{\s*sidechatURL:/);
  assert.match(sidechat, /chrome\.storage\.session\.get\(\['sidechatURL', 'sidechatError'\]/);
  assert.doesNotMatch(background, /chrome\.storage\.local\.set\(\{\s*sidechatURL:/);
});
