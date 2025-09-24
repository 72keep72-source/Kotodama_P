// キャッシュのバージョンを定義。ファイルを更新したら、ここの数字を'v1.1'のように変える
const CACHE_VERSION = 'v1.2'; 
const CACHE_NAME = `kotodama-protocol-cache-${CACHE_VERSION}`;

// キャッシュするファイルのリスト
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/css/main.css',
  '/src/main.js',
  '/src/ui.js',
  '/src/services/api.js',
  '/src/services/state.js',
  // ★その他、キャッシュしたいファイルがあればここに追加
];

// インストール時に、ファイルをキャッシュする
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('キャッシュを開きました:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
  );
});

// 新しいサービスワーカーが有効になったら、古いキャッシュを削除する
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => {
          // 現在のキャッシュ名と違うものは古いキャッシュと判断
          return cacheName !== CACHE_NAME;
        }).map((cacheName) => {
          console.log('古いキャッシュを削除:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
});


// ファイルのリクエストがあった場合に、キャッシュから返す
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュにあればそれを返す
        if (response) {
          return response;
        }
        // キャッシュになければ、ネットワークから取得して返す
        return fetch(event.request);
      })
  );
});