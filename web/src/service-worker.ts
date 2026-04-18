/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

const appShellEntries = [...build, ...files].map((url) => ({ url, revision: version }));

precacheAndRoute(appShellEntries);
cleanupOutdatedCaches();

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

const isSameOrigin = (url: URL): boolean => url.origin === self.location.origin;

const matchesMetadataRoute = (pathname: string): boolean =>
  /^\/api\/courses(?:\/.*)?$/.test(pathname) ||
  /^\/api\/tournaments\/[^/]+\/rounds$/.test(pathname) ||
  /^\/api\/live\/.*$/.test(pathname);

registerRoute(
  ({ url, request }) => isSameOrigin(url) && request.method === 'GET' && matchesMetadataRoute(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'metadata-cache',
  })
);

const matchesNetworkFirstRoute = (pathname: string): boolean =>
  /^\/api\/auth\/.*$/.test(pathname) ||
  /^\/api\/matches\/[^/]+\/holes(?:\/.*)?$/.test(pathname) ||
  /^\/api\/join\/.*$/.test(pathname);

const noCachePlugin = {
  cacheWillUpdate: async () => null,
};

registerRoute(
  ({ url, request }) =>
    isSameOrigin(url) && request.method === 'GET' && matchesNetworkFirstRoute(url.pathname),
  new NetworkFirst({
    cacheName: `network-first-no-store-${version}`,
    plugins: [noCachePlugin],
  })
);

registerRoute(
  ({ url, request }) =>
    isSameOrigin(url) &&
    request.method === 'GET' &&
    (url.pathname === '/manifest.webmanifest' || /^\/icons\/.*$/.test(url.pathname)),
  new CacheFirst({
    cacheName: `static-assets-cache-${version}`,
  })
);
