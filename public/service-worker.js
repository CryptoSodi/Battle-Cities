var CACHE_NAME = 'battle-cities-__BUILD_VERSION__';
var STATIC_PATH = /\.(?:js|css|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|mp3|ogg|wav|json)$/i;

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            if (key.indexOf('battle-cities-') === 0 && key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve(false);
          }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.indexOf('/api/') === 0 ||
    url.pathname === '/web-version.json'
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (STATIC_PATH.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

function networkFirst(request) {
  return fetch(request)
    .then(function (response) {
      if (response.ok) {
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, response.clone());
        });
      }
      return response;
    })
    .catch(function () {
      return caches.match(request).then(function (cached) {
        return cached || caches.match('/');
      });
    });
}

function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(request).then(function (cached) {
      var updated = fetch(request)
        .then(function (response) {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(function () {
          return cached;
        });

      return cached || updated;
    });
  });
}
