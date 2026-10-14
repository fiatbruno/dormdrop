import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

async function setup(listings) {
  const state = [], effects = [], removed = [];
  let cursor = 0;
  const context = vm.createContext({ AbortController });
  const module = values => new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context });
  const modules = {
    react: module({
      useState(initial) {
        const index = cursor++;
        state[index] = initial;
        return [initial, value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      },
      useCallback: callback => callback,
      useEffect: effect => effects.push(effect),
    }),
    '../api/savedItemsConfig': module({ default: { detailPath: id => `/items/${id}` } }),
    '../api/marketplaceApi': module({
      getFavorites: async () => Object.keys(listings),
      getListingById: async id => {
        const item = listings[id];
        if (item instanceof Error) throw item;
        return { id, ...item };
      },
      removeFavorite: async id => { removed.push(id); },
    }),
  };
  const hook = new vm.SourceTextModule(await readFile(new URL('../src/hooks/useSavedItems.js', import.meta.url), 'utf8'), { context });
  await hook.link(name => modules[name]);
  await hook.evaluate();
  const result = hook.namespace.default();
  effects.forEach(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  return { result, state, removed };
}

test('saved items resolve IDs, retain sold items, skip deleted listings, and support unsaving', async () => {
  const gone = Object.assign(new Error('Deleted'), { response: { status: 404 } });
  const { result, state, removed } = await setup({
    a: { title: 'Desk', price: 10, status: 'AVAILABLE', image: 'desk.jpg' },
    b: { title: 'Book', price: 5, status: 'SOLD', listingType: 'Free / Donate' },
    c: gone,
  });
  assert.equal(state[0].length, 2);
  assert.equal(state[0][0].imageUrl, 'desk.jpg');
  assert.equal(state[0][0].available, true);
  assert.equal(state[0][1].available, false);
  assert.equal(state[0][1].price, 'Free');
  assert.equal(state[1], false);
  assert.equal(state[2], '');
  assert.equal(result.getListingPath('a'), '/items/a');
  await result.onUnsave('a');
  assert.deepEqual(removed, ['a']);
  assert.equal(state[0].length, 1);
});

test('saved listing failures show an error instead of silently losing favorites', async () => {
  const failure = Object.assign(new Error('Offline'), { response: { status: 500 } });
  const { state } = await setup({ a: failure });
  assert.equal(state[1], false);
  assert.match(state[2], /Couldn't load saved items/);
});
