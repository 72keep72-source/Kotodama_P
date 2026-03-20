const REWARD_STORAGE_KEY = 'kotopro_reward_result';

function isSP() {
    return /iPhone|Android.+Mobile/.test(navigator.userAgent);
}

function renderImobileAd() {
    const container = document.getElementById('imobile-adpage-container');
    if (!container) return;

    if (isSP()) {
        // SP用
        container.innerHTML = `
            <div id="im-sp-ad">
                <script async src="https://imp-adedge.i-mobile.co.jp/script/v1/spot.js?20220104"><\/script>
                <script>
                    (window.adsbyimobile = window.adsbyimobile || []).push({
                        pid: 84078,
                        mid: 587427,
                        asid: 1926349,
                        type: "banner",
                        display: "inline",
                        elementid: "im-sp-ad"
                    });
                <\/script>
            </div>
        `;
    } else {
        // PC用
        container.innerHTML = `
            <div id="im-pc-ad">
                <script async src="https://imp-adedge.i-mobile.co.jp/script/v1/spot.js?20220104"><\/script>
                <script>
                    (window.adsbyimobile = window.adsbyimobile || []).push({
                        pid: 84078,
                        mid: 587426,
                        asid: 1926348,
                        type: "banner",
                        display: "inline",
                        elementid: "im-pc-ad"
                    });
                <\/script>
            </div>
        `;
    }
}

function getScenarioMessage(scenarioType) {
    if (scenarioType === 'sf') {
        return '通信帯域を再調整しています。しばらくお待ちください。';
    } else if (scenarioType === 'testS') {
        return 'お試しプレイありがとうございます。広告のあと、ゲーム選択画面に戻ります。';
    } else if (scenarioType === 'guildKURAGE') {
        return 'ギルドの特別依頼を処理しています。完了すると追加活動時間が付与されます。';
    } else {
        return '森の加護を整えています。しばらくお待ちください。';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const scenarioType = params.get('scenarioType') || 'fantasy';
    const returnTo = params.get('returnTo') || 'index.html';

    const statusText = document.getElementById('status-text');
    const backButton = document.getElementById('back-button');

    renderImobileAd();

    const baseMessage = getScenarioMessage(scenarioType);
    const waitSeconds = 8;
    let remaining = waitSeconds;

    statusText.innerHTML = `${baseMessage}<br>あと ${remaining} 秒で戻れます。`;

    const timer = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            statusText.innerHTML = `${baseMessage}<br>あと ${remaining} 秒で戻れます。`;
            return;
        }

        clearInterval(timer);

        statusText.innerHTML = `${baseMessage}<br>戻れるようになりました。`;
        backButton.classList.add('enabled');
        backButton.textContent = 'ゲームに戻る';

        backButton.addEventListener('click', (event) => {
            event.preventDefault();

            // testS は回復なし、通常は +5
            const rewardPayload = {
                granted: true,
                rewardType: scenarioType === 'testS' ? 'return_to_menu' : 'recover_actions',
                amount: scenarioType === 'testS' ? 0 : 5,
                scenarioType,
                ts: Date.now()
            };

            localStorage.setItem(REWARD_STORAGE_KEY, JSON.stringify(rewardPayload));
            window.location.href = returnTo;
        }, { once: true });

    }, 1000);
});