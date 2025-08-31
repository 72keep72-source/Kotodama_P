const CACHE_NAME = 'kotodama-protocol-cache-v1';
// オフライン用に保存しておくファイルのリスト
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/src/css/main.css',
    '/src/main.js',
    '/src/ui.js',
    '/src/services/state.js',
    '/src/services/api.js',
    '/src/assets/data/rulebook_1st.js',
    '/src/assets/data/rulebook_SF_AI.js',
    '/manifest.json'
];

// サービスワーカーのインストール処理
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('キャッシュを開きました');
                return cache.addAll(URLS_TO_CACHE);
            })
    );
});

// リクエストへの応答処理
self.addEventListener('fetch', event => {
    // ★★★ 修正箇所 ★★★
    // このサイトの管理下にないリクエスト（広告など）は無視する
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // キャッシュにあればそれを返す
                if (response) {
                    return response;
                }
                // なければネットワークから取得
                return fetch(event.request);
            })
    );
});

