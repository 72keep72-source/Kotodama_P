const CACHE_NAME = 'kotodama-protocol-cache-v1';
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
    '/src/assets/image/Kotodama_P_toka.png', // <-- この行を追加
    // favicon.ico やアイコン画像などもここに追加すると良い
];

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

    // ★★★ APIへのリクエストはキャッシュせず、常にネットワークに接続する ★★★
    if (requestUrl.pathname.startsWith('/.netlify/functions/')) {
        // 何もせず、ブラウザのデフォルトのネットワーク処理に任せる
        return; 
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // キャッシュにヒットした場合、それを返す
                if (response) {
                    return response;
                }
                // キャッシュになかった場合、ネットワークにリクエストしに行く
                return fetch(event.request);
            })
    );
});

