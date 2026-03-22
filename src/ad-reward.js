const REWARD_STORAGE_KEY = 'kotopro_reward_result';
const WAIT_SECONDS = 8;

function isSP() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function renderImobileAd() {
    const container = document.getElementById('imobile-adpage-container');
    if (!container) return;

    container.innerHTML = '';

    const isMobile = isSP();

    const adConfig = isMobile
        ? {
              elementId: 'im-5cffe2f326734a048036b15ba737cd5f',
              pid: 84078,
              mid: 587427,
              asid: 1926375
          }
        : {
              elementId: 'im-e629efec48294d9e854cdb6ad38d4c62',
              pid: 84078,
              mid: 587426,
              asid: 1926374
          };

    const adDiv = document.createElement('div');
    adDiv.id = adConfig.elementId;

    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = 'https://imp-adedge.i-mobile.co.jp/script/v1/spot.js?20220104';

    const script2 = document.createElement('script');
    script2.text = `(window.adsbyimobile=window.adsbyimobile||[]).push({
        pid:${adConfig.pid},
        mid:${adConfig.mid},
        asid:${adConfig.asid},
        type:"banner",
        display:"inline",
        elementid:"${adConfig.elementId}"
    })`;

    adDiv.appendChild(script1);
    adDiv.appendChild(script2);
    container.appendChild(adDiv);
}

function getScenarioMessage(scenarioType) {
    switch (scenarioType) {
        case 'sf':
            return '通信帯域を再調整しています。しばらくお待ちください。';
        case 'testS':
            return 'お試しプレイありがとうございます。広告のあと、ゲーム選択画面に戻ります。';
        case 'guildKURAGE':
            return 'ギルドの特別依頼を処理しています。完了すると追加活動時間が付与されます。';
        default:
            return '森の加護を整えています。しばらくお待ちください。';
    }
}

function getRewardPayload(scenarioType) {
    const isTestScenario = scenarioType === 'testS';

    return {
        granted: true,
        rewardType: isTestScenario ? 'return_to_menu' : 'recover_actions',
        amount: isTestScenario ? 0 : 5,
        scenarioType,
        ts: Date.now()
    };
}

function updateStatusText(statusText, baseMessage, remaining) {
    if (!statusText) return;

    if (remaining > 0) {
        statusText.innerHTML = `${baseMessage}<br>あと ${remaining} 秒で戻れます。`;
    } else {
        statusText.innerHTML = `${baseMessage}<br>戻れるようになりました。`;
    }
}

function sanitizeReturnTo(returnTo) {
    // 外部URLや危険なスキームを避けて、同一オリジンの相対パスだけ許可する簡易版
    if (!returnTo || returnTo.startsWith('http://') || returnTo.startsWith('https://') || returnTo.startsWith('javascript:')) {
        return 'index.html';
    }
    return returnTo;
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const scenarioType = params.get('scenarioType') || 'fantasy';
    const returnTo = sanitizeReturnTo(params.get('returnTo') || 'index.html');

    const statusText = document.getElementById('status-text');
    const backButton = document.getElementById('back-button');

    if (!statusText || !backButton) {
        console.warn('広告リワード画面の必須要素が見つかりません。');
        return;
    }

    renderImobileAd();

    const baseMessage = getScenarioMessage(scenarioType);
    let remaining = WAIT_SECONDS;

    updateStatusText(statusText, baseMessage, remaining);

    const timer = setInterval(() => {
        remaining -= 1;

        if (remaining > 0) {
            updateStatusText(statusText, baseMessage, remaining);
            return;
        }

        clearInterval(timer);

        updateStatusText(statusText, baseMessage, 0);
        backButton.classList.add('enabled');
        backButton.textContent = 'ゲームに戻る';

        backButton.addEventListener(
            'click',
            (event) => {
                event.preventDefault();

                const rewardPayload = getRewardPayload(scenarioType);
                localStorage.setItem(REWARD_STORAGE_KEY, JSON.stringify(rewardPayload));

                window.location.href = returnTo;
            },
            { once: true }
        );
    }, 1000);
});