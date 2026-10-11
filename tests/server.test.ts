import assert from 'node:assert/strict';
import test from 'node:test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
// Native Node ESM intentionally runs without a TypeScript build step.
// @ts-expect-error JavaScript server is exercised directly by Node.
import { createLeadServer } from '../scripts/server.mjs';
import { createInitialState, exportSummary } from '../src/state';

async function fixture(run: (context: { url: string; root: string; data: string; server: Server }) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'smart-house-server-'));
  const data = path.join(root, 'data', 'leads');
  await fs.mkdir(path.join(root, 'dist'));
  await fs.writeFile(path.join(root, 'dist', 'index.html'), '<!doctype html><title>Smart House</title>');
  const server: Server = createLeadServer({ rootDirectory: root });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try { await run({ url: `http://127.0.0.1:${address.port}`, root, data, server }); }
  finally { await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }); await fs.rm(root, { recursive: true, force: true }); }
}
const payload = () => ({ contact: { name: 'Анна', channel: 'anna@example.test', comment: 'Свет и шторы' }, configuration: exportSummary(createInitialState()) });
const submit = (url: string, body: unknown, origin = url) => fetch(url + '/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });

test('local API confirms only after a private JSON record has been saved', async () => {
  await fixture(async ({ url, data }) => {
    const response = await submit(url, payload());
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.ok, true);
    assert.equal(result.stored, 'local');
    assert.match(result.id, /^[0-9a-f-]{36}$/);
    const filenames = await fs.readdir(data);
    assert.deepEqual(filenames, [result.id + '.json']);
    const filename = path.join(data, filenames[0]);
    const saved = JSON.parse(await fs.readFile(filename, 'utf8'));
    assert.equal(saved.contact.name, 'Анна');
    assert.equal(saved.status, 'local-only-not-sent-to-sales');
    assert.equal((await fs.stat(filename)).mode & 0o077, 0, 'contact file is private to the user');
  });
});

test('invalid contact, unknown configuration, cross-origin and oversized submissions write nothing', async () => {
  await fixture(async ({ url, data }) => {
    const invalid = payload(); invalid.contact.name = ' ';
    assert.equal((await submit(url, invalid)).status, 400);
    const unknown = payload(); unknown.configuration.systems[0].id = 'unknown' as typeof unknown.configuration.systems[0]['id'];
    assert.equal((await submit(url, unknown)).status, 400);
    assert.equal((await submit(url, payload(), 'https://example.test')).status, 403);
    const huge = { ...payload(), extra: 'x'.repeat(70_000) };
    assert.equal((await submit(url, huge)).status, 413);
    assert.equal((await fetch(url + '/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url }, body: '{' })).status, 400);
    await assert.rejects(fs.readdir(data), { code: 'ENOENT' });
  });
});

test('a storage failure never produces a successful lead confirmation', async () => {
  await fixture(async ({ url, root }) => {
    await fs.writeFile(path.join(root, 'data'), 'This file prevents creating data/leads.');
    const response = await submit(url, payload());
    assert.equal(response.status, 500);
    assert.equal((await response.json()).ok, false);
  });
});

test('configuration identifiers cannot use arrays that coerce into valid names', async () => {
  await fixture(async ({ url, data }) => {
    const normal = payload();
    const malformedConfigurations = [
      { ...normal.configuration, systems: [{ id: ['lighting'] }] },
      { ...normal.configuration, selectedRooms: [{ id: ['living'] }] },
      { ...normal.configuration, lastScenario: { id: ['morning'] } },
    ];
    for (const configuration of malformedConfigurations) {
      const response = await submit(url, { ...normal, configuration });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).ok, false);
    }
    await assert.rejects(fs.readdir(data), { code: 'ENOENT' });
  });
});

test('static serving confines paths and symlinks to dist and never exposes contacts', async () => {
  await fixture(async ({ url, root }) => {
    await fs.writeFile(path.join(root, 'private.txt'), 'private secret');
    await fs.symlink(path.join(root, 'private.txt'), path.join(root, 'dist', 'secret.txt'));
    assert.equal((await fetch(url + '/')).status, 200);
    const traversal = await fetch(url + '/%2e%2e%2fprivate.txt');
    assert.equal(traversal.status, 403);
    assert.equal((await fetch(url + '/secret.txt')).status, 403);
    assert.equal((await fetch(url + '/data/leads/example.json')).status, 404);
    assert.equal((await fetch(url + '/%00')).status, 400);
  });
});

test('server-rendered form works without scripts and escapes rejected values', async () => {
  await fixture(async ({ url, data }) => {
    const page = await fetch(url + '/request');
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /method="post" action="\/request"/);
    assert.ok(!html.includes('<script'));
    const malicious = new URLSearchParams({ name: '<script>alert(1)</script>', channel: '', comment: '</textarea><script>alert(1)</script>' });
    const rejected = await fetch(url + '/request', { method: 'POST', headers: { Origin: url }, body: malicious });
    assert.equal(rejected.status, 400);
    const errorHTML = await rejected.text();
    assert.ok(!errorHTML.includes('<script>'));
    assert.match(errorHTML, /&lt;script&gt;/);
    const form = new URLSearchParams({ name: 'Анна', channel: 'anna@example.test', system: 'lighting', room: 'living', scenario: 'morning' });
    const accepted = await fetch(url + '/request', { method: 'POST', headers: { Origin: url }, body: form });
    assert.equal(accepted.status, 201);
    assert.match(await accepted.text(), /Заявка сохранена на локальном сервере/);
    assert.equal((await fs.readdir(data)).length, 1);
  });
});
