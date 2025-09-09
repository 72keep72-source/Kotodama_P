const CACHE_NAME = 'kotodama-protocol-cache-v2'; // ★キャッシュバージョンを更新
// キャッシュするファイルのリスト
const urlsToCache = [
    '/',
    '/index.html',
    '/src/css/main.css',
    '/src/main.js',
    '/src/ui.js',
    '/src/services/state.js',
    '/src/services/api.js',
    '/src/assets/data/rulebook_1st.js',
    '/src/assets/data/rulebook_SF_AI.js',
    '/manifest.json',
    'src/assets/image/Kotodama_P_toka.png' // ★新しいPNGアイコンをキャッシュ
];

// --- (以降のサービスワーカーのコードは変更ありません) ---

// 古いキャッシュを削除する処理を追加すると、より確実です
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                          .map(name => caches.delete(name))
            );
        })
    );
});


// インストール時に、ファイルをキャッシュする
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('キャッシュを開きました');
                return cache.addAll(urlsToCache);
            })
    );
});

// fetchイベントを監視し、キャッシュまたはネットワークから応答を返す
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // APIへのリクエストはキャッシュせず、常にネットワークに接続する
    if (requestUrl.pathname.startsWith('/.netlify/functions/')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

