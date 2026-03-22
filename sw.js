// キャッシュのバージョン
const CACHE_VERSION = 'v3.0';
const CACHE_NAME = `kotodama-protocol-cache-${CACHE_VERSION}`;

// 事前キャッシュするファイル
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/css/main.css',
  '/src/main.js',
  '/src/ui.js',
  '/src/services/api.js',
  '/src/services/state.js',
  '/src/assets/data/rulebook_1st.js',
  '/src/assets/data/rulebook_SF_AI.js',
  '/src/assets/data/rulebook_Otameshi.js',
  '/src/assets/data/rulebook_guildKURAGE.js',
];

// インストール時にキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('キャッシュを開きました:', CACHE_NAME);
      return cache.addAll(urlsToCache);
    })
  );

  self.skipWaiting();
});

// 有効化時に古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => {
            console.log('古いキャッシュを削除:', cacheName);
            return caches.delete(cacheName);
          })
      );

      await self.clients.claim();
    })()
  );
});

// キャッシュ対象かどうか判定
function shouldHandleRequest(request) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);

  // http / https 以外は対象外
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  // 広告系はSWで触らない
  if (
    url.origin === 'https://imp-adedge.i-mobile.co.jp' ||
    url.hostname.includes('i-mobile.co.jp')
  ) {
    return false;
  }

  return true;
}

// fetch時はキャッシュ優先、なければネットワーク
self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (!shouldHandleRequest(request)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      const networkResponse = await fetch(request);

      // キャッシュ対象は正常なbasicレスポンスだけ
      if (
        networkResponse &&
        networkResponse.status === 200 &&
        networkResponse.type === 'basic'
      ) {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache).catch((error) => {
            console.warn('cache.put に失敗:', request.url, error);
          });
        });
      }

      return networkResponse;
    })().catch((error) => {
      console.error('SW fetch failed:', request.url, error);
      throw error;
    })
  );
});