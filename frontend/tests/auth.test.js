import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import axios from "axios";

async function setup(initialToken) {
  const values = new Map(initialToken ? [["token", initialToken], ["user", "cached"]] : []);
  const handlers = {};
  let timer;
  const context = vm.createContext({
    atob, Date, JSON, Set, Number,
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key),
    },
    window: { addEventListener: (name, handler) => { handlers[name] = handler; } },
    setTimeout: (callback, delay) => { timer = { callback, delay }; return 1; },
    clearTimeout: () => { timer = null; },
  });
  const session = new vm.SourceTextModule(await readFile(new URL('../src/auth/session.js', import.meta.url), 'utf8'), { context });
  await session.link(() => {});
  await session.evaluate();
  const axiosModule = new vm.SyntheticModule(['default'], function () { this.setExport('default', axios); }, { context });
  const client = new vm.SourceTextModule(await readFile(new URL('../src/api/client.js', import.meta.url), 'utf8'), {
    context, initializeImportMeta: meta => { meta.env = {}; },
  });
  await client.link(name => name === 'axios' ? axiosModule : session);
  await client.evaluate();
  return { session: session.namespace, api: client.namespace.default, values, handlers, timer: () => timer };
}
const token = (exp, subject = 'student') => `header.${Buffer.from(JSON.stringify({ exp, sub: subject })).toString('base64url')}.signature`;
const valid = () => token(Date.now() / 1000 + 3600);

for (const invalid of [undefined, 'malformed', token(1), token('invalid')]) {
  test(`invalid initial session is cleared: ${invalid}`, async () => {
    const { session, values } = await setup(invalid);
    assert.equal(session.getToken(), null);
    assert.equal(values.has('token'), false);
    assert.equal(values.has('user'), false);
  });
}

test('login/logout publish state and cross-tab logout clears the session', async () => {
  const { session, values, handlers } = await setup();
  let changes = 0;
  session.subscribe(() => changes++);
  session.login(valid());
  assert.ok(session.getToken());
  values.delete('token');
  handlers.storage({ key: 'token' });
  assert.equal(session.getToken(), null);
  session.login(valid());
  session.logout();
  assert.equal(session.getToken(), null);
  assert.equal(changes, 4);
});

test('expiry timer clears the session', async () => {
  const { session, values, timer } = await setup(valid());
  assert.ok(timer().delay > 0);
  values.set('token', token(1));
  timer().callback();
  assert.equal(session.getToken(), null);
});

for (const [status, url, loggedOut] of [[401, '/home', true], [403, '/home', false], [401, '/auth/login', false]]) {
  test(`${status} from ${url}: logout=${loggedOut}`, async () => {
    const { session, api } = await setup(valid());
    api.defaults.adapter = async config => {
      assert.equal(config.headers.Authorization, `Bearer ${session.getToken()}`);
      throw { config, response: { status } };
    };
    await assert.rejects(api.get(url));
    assert.equal(session.getToken() === null, loggedOut);
  });
}

test('old request cannot log out a newer session', async () => {
  const { session, api } = await setup(valid());
  const newer = token(Date.now() / 1000 + 7200, 'new-session');
  api.defaults.adapter = async config => {
    session.login(newer);
    throw { config, response: { status: 401 } };
  };
  await assert.rejects(api.get('/home'));
  assert.equal(session.getToken(), newer);
});

test('protected route redirects logged-out visits and renders logged-in content', async () => {
  const React = await import('react');
  const runtime = await import('react/jsx-runtime');
  const router = await import('react-router-dom');
  const { transformWithOxc } = await import('vite');
  const context = vm.createContext({});
  let isAuthenticated = false;
  const exportsModule = exports => new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
  }, { context });
  const modules = {
    'react': exportsModule(React),
    'react/jsx-runtime': exportsModule(runtime),
    'react-router-dom': exportsModule(router),
    '../hooks/useAuth': exportsModule({ default: () => ({ isAuthenticated }) }),
  };
  const source = await readFile(new URL('../src/components/ProtectedRoute.jsx', import.meta.url), 'utf8');
  const { code } = await transformWithOxc(source, 'ProtectedRoute.jsx', { jsx: { runtime: 'automatic' } });
  const guard = new vm.SourceTextModule(code, { context });
  await guard.link(name => modules[name]);
  await guard.evaluate();
  const child = React.createElement('div', null, 'private');
  const redirect = guard.namespace.default({ children: child });
  assert.equal(redirect.type, router.Navigate);
  assert.equal(redirect.props.to, '/login');
  assert.equal(redirect.props.replace, true);
  isAuthenticated = true;
  assert.equal(guard.namespace.default({ children: child }), child);
  isAuthenticated = false;
  assert.equal(guard.namespace.default({ children: child }).type, router.Navigate);
});

test('listing images fetch authenticated blobs and release object URLs', async () => {
  let cleanup;
  let loaded;
  let request;
  const released = [];
  const urlApi = class extends URL {};
  urlApi.createObjectURL = () => 'blob:test';
  urlApi.revokeObjectURL = url => released.push(url);
  const context = vm.createContext({ URL: urlApi, AbortController, window: { location: { origin: 'http://localhost:5173' } } });
  const exportsModule = exports => new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
  }, { context });
  const modules = {
    'react': exportsModule({
      useState: () => [loaded, value => { loaded = value; }],
      useEffect: effect => { cleanup = effect(); },
    }),
    '../api/client': exportsModule({ default: {
      defaults: { baseURL: 'http://localhost:8080/api/v1' },
      get: async (url, config) => { request = { url, config }; return { data: 'blob-data' }; },
    } }),
    './useAuth': exportsModule({ default: () => ({ token: 'valid' }) }),
  };
  const hook = new vm.SourceTextModule(await readFile(new URL('../src/hooks/useListingImage.js', import.meta.url), 'utf8'), { context });
  await hook.link(name => modules[name]);
  await hook.evaluate();
  assert.equal(hook.namespace.default('/api/v1/images/test.jpg'), '');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(request.url, 'http://localhost:8080/api/v1/images/test.jpg');
  assert.equal(request.config.responseType, 'blob');
  assert.equal(loaded.url, 'blob:test');
  cleanup();
  assert.equal(request.config.signal.aborted, true);
  assert.deepEqual(released, ['blob:test']);
  request = null;
  assert.equal(hook.namespace.default('https://example.com/image.jpg'), 'https://example.com/image.jpg');
  assert.equal(request, null);
});
