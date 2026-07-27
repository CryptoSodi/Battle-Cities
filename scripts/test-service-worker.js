const assert = require('assert');
const { readFileSync } = require('fs');
const vm = require('vm');

let fetchHandler;
let resolveCache;
let responsePromise;
let cachedBody = null;

const cacheReady = new Promise((resolve) => {
  resolveCache = resolve;
});
const context = {
  URL,
  fetch: async () => new Response('<html>battle cities</html>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  }),
  caches: {
    open: () => cacheReady,
    keys: async () => [],
    delete: async () => true,
    match: async () => null,
  },
  self: {
    location: { origin: 'https://battlecities.test' },
    skipWaiting: () => undefined,
    clients: { claim: async () => undefined },
    addEventListener: (type, listener) => {
      if (type === 'fetch') fetchHandler = listener;
    },
  },
};

vm.runInNewContext(
  readFileSync('public/service-worker.js', 'utf8'),
  context,
);

fetchHandler({
  request: {
    method: 'GET',
    mode: 'navigate',
    url: 'https://battlecities.test/',
    headers: { has: () => false },
  },
  respondWith: (promise) => {
    responsePromise = promise;
  },
});

(async () => {
  const response = await responsePromise;
  assert.strictEqual(await response.text(), '<html>battle cities</html>');

  resolveCache({
    put: async (_request, cacheResponse) => {
      cachedBody = await cacheResponse.text();
    },
    match: async () => null,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.strictEqual(
    cachedBody,
    '<html>battle cities</html>',
    'navigation response must remain cacheable after the page consumes it',
  );
  console.log('service worker delayed navigation cache: ok');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
