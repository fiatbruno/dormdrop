import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test('listing details, edits, and replacement photos use the backend contract', async () => {
  const requests = [];
  const listing = { id: 'abc', title: 'Desk', price: 25, pickupArea: 'Gerber Center', imageUrl: '/api/v1/images/desk.jpg', listedOn: '2026-10-14T12:00:00' };
  const context = vm.createContext({ URL, FormData, window: { location: { origin: 'http://localhost:5173' } } });
  const api = {
    defaults: { baseURL: 'http://localhost:8080/api/v1' },
    get: async path => { requests.push({ path }); return { data: listing }; },
    put: async (path, body) => { requests.push({ path, body }); return { data: listing }; },
    post: async (path, body) => { requests.push({ path, body }); return { data: {} }; },
  };
  const client = new vm.SyntheticModule(['default'], function () { this.setExport('default', api); }, { context });
  const module = new vm.SourceTextModule(await readFile(new URL('../src/api/marketplaceApi.js', import.meta.url), 'utf8'), { context });
  await module.link(() => client);
  await module.evaluate();
  const details = await module.namespace.getListingById('abc');
  assert.equal(requests[0].path, '/home/abc');
  assert.equal(details.pickupLocation, 'Gerber Center');
  assert.equal(details.image, 'http://localhost:8080/api/v1/images/desk.jpg');
  await module.namespace.updateListing('abc', { ...details, price: '30' });
  assert.equal(requests[1].path, '/home/abc');
  assert.equal(requests[1].body.pickupArea, 'Gerber Center');
  assert.equal(requests[1].body.price, 30);
  await module.namespace.uploadListingImage('abc', new Blob(['photo'], { type: 'image/jpeg' }));
  assert.equal(requests[2].path, '/images/abc');
  assert.ok(requests[2].body.get('file'));
});
