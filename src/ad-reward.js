const REWARD_STORAGE_KEY = 'kotopro_reward_result';

function getScenarioMessage(scenarioType) {
    if (scenarioType === 'sf') {
        return '通信帯域の再割り当てが進行中です。しばらくお待ちください。';
    } else if (scenarioType === 'testS') {
        return 'お試しプレイ用の広告です。視聴後にゲーム選択へ戻れます。';
    } else if (scenarioType === 'guildKURAGE') {
        return 'ギルドの特別依頼を処理中です。完了すると追加活動時間が付与されます。';
    } else {
        return '森の加護を回復中です。しばらくお待ちください。';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const scenarioType = params.get('scenarioType') || 'fantasy';
    const returnTo = params.get('returnTo') || 'index.html';

    const statusText = document.getElementById('status-text');
    const backButton = document.getElementById('back-button');

    statusText.innerHTML = getScenarioMessage(scenarioType);

  document.getElementById('imobile-ad-container').innerHTML = '広告スペース';

    const waitSeconds = 8;

    let remaining = waitSeconds;
    const timer = setInterval(() => {
        statusText.innerHTML = `${getScenarioMessage(scenarioType)}<br>あと ${remaining} 秒で戻れます。`;
        remaining--;

        if (remaining < 0) {
            clearInterval(timer);

            backButton.classList.add('enabled');
            backButton.textContent = 'ゲームに戻る';

            backButton.addEventListener('click', (event) => {
                event.preventDefault();

                localStorage.setItem(REWARD_STORAGE_KEY, JSON.stringify({
                    granted: true,
                    amount: 5,
                    scenarioType,
                    ts: Date.now()
                }));

                window.location.href = returnTo;
            }, { once: true });
        }
    }, 1000);
});