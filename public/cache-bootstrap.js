(function () {
  var capacitor = window.Capacitor;
  var isNative =
    capacitor &&
    typeof capacitor.isNativePlatform === 'function' &&
    capacitor.isNativePlatform();

  if (!isNative && 'serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/service-worker.js').catch(function () {
        // Offline caching is an enhancement; startup must never depend on it.
      });
    });
  }
})();
