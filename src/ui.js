import { calculateModifier } from './services/state.js';

// --- DOM要素の保持用変数 ---
let gameLog, userInput, sendButton, statusDisplay, actionCountDisplay, actionsContainer, playerNameDisplay, inventoryDisplay, slotSelector, scenarioSelectionContainer, hintToggleButton, adModalOverlay, adModalText, adConfirmButton, adCancelButton, adLoadingSpinner;


// --- 初期化 ---
export function initializeUI() {
    gameLog = document.getElementById('game-log');
    userInput = document.getElementById('user-input');
    sendButton = document.getElementById('send-button');
    statusDisplay = document.getElementById('status-display');
    actionCountDisplay = document.getElementById('action-count-display');
    actionsContainer = document.getElementById('actions-container');
    playerNameDisplay = document.getElementById('player-name-display');
    inventoryDisplay = document.getElementById('inventory-display');
    slotSelector = document.getElementById('slot-selector');
    scenarioSelectionContainer = document.getElementById('scenario-selection-container');
    hintToggleButton = document.getElementById('hint-toggle-button');
    adModalOverlay = document.getElementById('ad-modal-overlay');
    adModalText = document.querySelector('#ad-modal-overlay p.ad-modal-text');
    adConfirmButton = document.getElementById('ad-confirm-button');
    adCancelButton = document.getElementById('ad-cancel-button');
    adLoadingSpinner = document.getElementById('ad-loading-spinner');
}

let onAdSuccessCallback = null;

// --- ヘルパー関数 ---
const statDescriptions = {
    HP: "ヒットポイント：キャラクターの生命力。0になると倒れる。",
    STR: "筋力 (Strength)：腕力や、物理的な攻撃の強さに影響する。",
    DEX: "敏捷性 (Dexterity)：素早さや、身のこなしの器用さに影響する。",
    CON: "耐久力 (Constitution)：体力や、打たれ強さに影響する。",
    INT: "知力 (Intelligence)：知識の量や、論理的な思考力に影響する。",
    WIS: "判断力 (Wisdom)：直感や、知恵の深さに影響する。",
    CHA: "魅力 (Charisma)：人を惹きつける力や、交渉能力に影響する。"
};


// --- UI更新関数 ---

export function addLog(text, className) {
    const p = document.createElement('p');
    p.innerHTML = text.replace(/\n/g, '<br>');
    if (className) {
        className.split(' ').forEach(cls => p.classList.add(cls));
    }
    gameLog.appendChild(p);
    gameLog.scrollTop = gameLog.scrollHeight;
    return p;
}

export function updateThinkingMessage(newText) {
    const thinkingElement = Array.from(gameLog.getElementsByTagName('p')).find(p => p.textContent.trim() === '考え中...');
    if (thinkingElement) {
        thinkingElement.innerHTML = newText.replace(/\n/g, '<br>');
    }
}

export function clearInput() {
    userInput.value = '';
    userInput.style.height = 'auto';
}

export function clearActions() {
    actionsContainer.innerHTML = '';
}

export function updateSlotSelector({ gameSlots, maxSlots }) {
    slotSelector.innerHTML = '';
    
    const placeholder = document.createElement('option');
    placeholder.textContent = 'データを選択してください';
    placeholder.value = ''; 
    slotSelector.appendChild(placeholder);

    if (gameSlots && gameSlots.length > 0) {
        gameSlots.forEach((slot, index) => {
            const option = document.createElement('option');
            option.value = slot.id;
            option.textContent = `データ${index + 1}: ${slot.name || '（名前未設定）'}`;
            slotSelector.appendChild(option);
        });
    }

    if (!maxSlots || gameSlots.length < maxSlots) {
        const newGameOption = document.createElement('option');
        newGameOption.textContent = '新規ゲームを始める';
        newGameOption.value = 'new_game';
        slotSelector.appendChild(newGameOption);
    }
    
    const lastSelectedId = localStorage.getItem('rpgActiveSlotId');
    if (lastSelectedId && gameSlots.some(s => s.id == lastSelectedId)) {
        slotSelector.value = lastSelectedId;
    }
}


export function updatePlayerNameDisplay(name) {
    playerNameDisplay.textContent = name;
}

export function updateStatusDisplay({ playerStats, modifiedStats }, changes = {}) {
    statusDisplay.innerHTML = '';
    if (!playerStats || Object.keys(playerStats).length === 0) return;

    for (const [key, value] of Object.entries(playerStats)) {
        const p = document.createElement('p');
        const label = document.createElement('span');
        label.textContent = `${key}:`;
        label.className = 'tooltip';
        label.setAttribute('data-tooltip', statDescriptions[key] || '');

        const valueContainer = document.createElement('span');
        const valueSpan = document.createElement('span');
        valueSpan.className = 'stat-value';

        if (key === 'HP') {
            valueSpan.textContent = `${value.current} / ${value.max}`;
        } else {
            if (modifiedStats.has(key)) {
                const modifierString = calculateModifier(value);
                valueSpan.textContent = modifierString ? `${value} (${modifierString})` : `${value}`;
            } else {
                valueSpan.textContent = value;
            }
        }
        valueContainer.appendChild(valueSpan);

        if (changes[key]) {
            const changeSpan = document.createElement('span');
            changeSpan.className = 'stat-change';
            changeSpan.textContent = `(${changes[key]})`;
            valueContainer.appendChild(changeSpan);
            setTimeout(() => { if (changeSpan.isConnected) changeSpan.remove(); }, 2000);
        }
        p.appendChild(label);
        p.appendChild(valueContainer);
        statusDisplay.appendChild(p);
    }
}

export function updateActionCountDisplay({ current, limit }) {
    actionCountDisplay.textContent = `${current || 0} / ${limit || 50}`;
}


export function updateInventoryDisplay(inventory) {
    inventoryDisplay.innerHTML = '';
    if (!inventory || inventory.length === 0) {
        inventoryDisplay.innerHTML = '<p>何も持っていない</p>';
    } else {
        inventory.forEach(item => {
            const p = document.createElement('p');
            p.textContent = `・${item}`;
            inventoryDisplay.appendChild(p);
        });
    }
}

export function displayActions(actions, commandHandler) {
    actionsContainer.innerHTML = '';
    if (actions && actions.length > 0) {
        actions.forEach(actionText => {
            const button = document.createElement('button');
            button.textContent = actionText;
            button.className = 'action-button';
            button.addEventListener('click', () => {
                actionsContainer.querySelectorAll('.action-button').forEach(btn => btn.disabled = true);
                button.classList.add('fade-out');
                setTimeout(() => commandHandler(actionText), 500);
            });
            actionsContainer.appendChild(button);
        });
    }
}

export function toggleInput(disabled, placeholderText = '') {
    userInput.disabled = disabled;
    sendButton.disabled = disabled;
    userInput.placeholder = placeholderText || (disabled ? '' : 'どうする？ (Ctrl+Enterで送信)');
}

export function clearGameScreen() {
    if(!gameLog || !scenarioSelectionContainer || !actionsContainer) return;
    gameLog.innerHTML = '';
    scenarioSelectionContainer.innerHTML = '';
    actionsContainer.innerHTML = '';
     // ★★★ 修正点：古い完了ボタンが残っていたら、それも削除する ★★★
    const nextScenarioBtn = document.querySelector('.next-scenario-button');
    if(nextScenarioBtn) nextScenarioBtn.remove();

    updateAllDisplays({
        playerStats: {},
        modifiedStats: new Set(),
        dailyActions: { current: 0, limit: 50 },
        inventory: [],
        playerName: ''
    });
}

export function rebuildLog(conversationHistory) {
    gameLog.innerHTML = '';
    (conversationHistory || []).slice(1).forEach(turn => {
        if (!turn || !turn.parts || !turn.parts[0]) {
            console.warn('会話履歴に不正なデータが含まれていたため、スキップしました:', turn);
            return;
        }
        const text = turn.parts[0].text;
        if (turn.role === 'user') {
            addLog(`> ${text}`, 'user-command');
        } else {
            const storyText = text.split('\n').filter(line => !line.startsWith('[')).join('\n');
            addLog(storyText, 'ai-response');
        }
    });
}

export function showWelcomeScreen(hasSaveData) {
    clearGameScreen();
    
    let welcomeMessage = hasSaveData
        ? 'おかえりなさい、旅人よ。<br>冒険を再開、または新規に始めるには、サイドバーのプルダウンから選択して「決定」を押してください。'
        : 'ようこそ、「言霊のプロトコル」へ。<br>冒険を始めるには、サイドバーのプルダウンから「新規ゲームを始める」を選択してください。';
    
    addLog(welcomeMessage, 'ai-response');
    toggleInput(true, 'データを選択して「決定」してください');
}

export function showTemporaryMessage(message) {
    const existingMessage = document.querySelector('.temp-message');
    if (existingMessage) existingMessage.remove();

    const tempMessage = addLog(`【！】 ${message}`, 'system-warning temp-message');
    setTimeout(() => {
        if (tempMessage.isConnected) {
            tempMessage.remove();
        }
    }, 3000);
}

export function showScenarioSelection(scenarioHandler, hasSaveData) {
    clearGameScreen();

    const scenarioWelcomeMessage = hasSaveData
        ? '▼ 始めたい物語を、下から選択してください。'
        : '冷たい石の感触。失われた記憶。<br>あなたは石碑の前で倒れている。<br>ここが剣と魔法の世界なのか、AIが支配する未来なのか…<br>それすら、まだ決まってはいない。<br>すべては、あなたの最初の「言霊」から始まる。<br>▼ 始めたい物語を、下から選択してください。';
    
    addLog(scenarioWelcomeMessage, 'ai-response');
    toggleInput(true, '物語を選択してください');

    scenarioSelectionContainer.innerHTML = '';
    const scenarios = [
        { name: 'お手軽ゲーム', type: 'testS', description: '森でとらわれてる狼にあなたはどう行動を起こす？AIの反応お試し用' },
        { name: 'ギルドで依頼を受けてみる', type: 'guildKURAGE', description: '今日のギルドの掲示板にはなにやら依頼が入っているようだ。byくらげ' },
        { name: '剣と魔法の世界', type: 'fantasy', description: '呪われた森で失われた記憶の《コア》を探す、王道ファンタジー。' },
        { name: 'AIが管理する未来的な世界', type: 'sf', description: '巨大サイバー都市で失われた記憶《媒体》を探す、SFアドベンチャー。' }
    ];

    scenarios.forEach(scenario => {
        const card = document.createElement('div');
        card.className = 'scenario-card';
        card.innerHTML = `<h3>${scenario.name}</h3><p>${scenario.description}</p>`;
        card.onclick = () => {
            scenarioHandler(scenario.type);
        };
        scenarioSelectionContainer.appendChild(card);
    });
}


export function updateAllDisplays(gameState, changes = {}) {
    updatePlayerNameDisplay(gameState.playerName || '');
    updateStatusDisplay(gameState, changes);
    updateActionCountDisplay(gameState.dailyActions || { current: 0, limit: 50 });
    updateInventoryDisplay(gameState.inventory || []);
}

export function exportSaveData(activeSlotData) {
    if (!activeSlotData) {
        showTemporaryMessage('エクスポートするゲームデータがありません。');
        return;
    }
    const saveDataJson = JSON.stringify(activeSlotData, null, 2);
    const blob = new Blob([saveDataJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const date = new Date();
    const formattedDate = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    a.download = `${activeSlotData.name || 'save'}_${formattedDate}.json`; 
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


export function initializeHintButton() {
    if (!hintToggleButton) { 
        console.error("ヒントボタンの要素が見つかりません。");
        return;
    }
    
    let hintsVisible = localStorage.getItem('hintsVisible') === 'true';

    const updateHintState = () => {
        if (hintsVisible) {
            hintToggleButton.textContent = 'ヒントを隠す';
            hintToggleButton.classList.add('active');
            actionsContainer.style.display = 'block';
        } else {
            hintToggleButton.textContent = 'ヒントを表示';
            hintToggleButton.classList.remove('active');
            actionsContainer.style.display = 'none';
        }
    };
    
    hintToggleButton.addEventListener('click', () => {
        hintsVisible = !hintsVisible;
        localStorage.setItem('hintsVisible', hintsVisible);
        updateHintState();
    });

    updateHintState();
}

export function initializeAdModal(onConfirm) {
    adCancelButton.addEventListener('click', () => adModalOverlay.classList.remove('visible'));
    
    adConfirmButton.addEventListener('click', () => {
        // --- ▼▼▼ ここからがテスト用の仮表示ロジックです ▼▼▼ ---

        // 1. ローディングスピナーを表示し、ボタンを隠す
        adLoadingSpinner.style.display = 'block';
        adConfirmButton.style.display = 'none';
        adCancelButton.style.display = 'none';

        // 2. 3秒待ってから、広告が成功したと仮定する
        setTimeout(() => {
            // 3. onAdSuccessCallbackに関数が保存されていれば、それを実行する
            if (onAdSuccessCallback) {
                onAdSuccessCallback();
            }

            // 4. モーダルを閉じ、UIを元に戻す
            adModalOverlay.classList.remove('visible');
            adLoadingSpinner.style.display = 'none';
            adConfirmButton.style.display = 'inline-block';
            adCancelButton.style.display = 'inline-block';
        }, 3000); // 3000ミリ秒 = 3秒

        // --- ▲▲▲ ここまでがテスト用の仮表示ロジックです ▲▲▲ ---
    });
}


/**本番用こめんとあうと
export function initializeAdModal(onConfirm) {
    adCancelButton.addEventListener('click', () => adModalOverlay.classList.remove('visible'));
    adConfirmButton.addEventListener('click', () => {
        adLoadingSpinner.style.display = 'block';
        adConfirmButton.style.display = 'none';
        adCancelButton.style.display = 'none';
        
        onConfirm(() => {
            adModalOverlay.classList.remove('visible');
            adLoadingSpinner.style.display = 'none';
            adConfirmButton.style.display = 'inline-block';
            adCancelButton.style.display = 'inline-block';
        });
    });
}　*/


export function showAdModal(scenarioType, successCallback) {
    // 成功した時に実行したい処理を、グローバル変数に保存
    onAdSuccessCallback = successCallback;

    let message = '';
    if (scenarioType === 'sf') {
        message = '警告：精神負荷が臨界点に達しました。<br>これ以上のマトリクスへの接続は、あなたの精神崩壊を招きます。<br>ネットワークへの再アクセスは、システムデイリーメンテナンス（毎日午前4時）の完了後に許可されます。';
    } else if (scenarioType === 'testS') {
        message = 'お試しプレイありがとうございます！<br>広告を見ることでゲーム選択画面に戻ります。'; 
    } else if (scenarioType === 'guildKURAGE') {
        message = '陽も傾き、今日のギルド活動時間は終了だ。<br>活動の再開は翌朝（午前4時）からとなる。ただし、ギルドの「取引先からの特別な依頼（広告）」をこなすことで、組合から僅かな追加活動時間が許可される。'; 
    } else {
        message = '夜の森を覆う呪いが、あなたの理性を蝕んでいく…<br>これ以上は危険だ。今は身を潜め、心を休めるしかない。<br>呪いが和らぐ夜明け（午前4時）と共に、再びあなたの道は開かれるだろう。';
    }
    adModalText.innerHTML = message;
    adModalOverlay.classList.add('visible');
}

/**
 * 広告通ったらこれにする。
 * export function showAdModal(scenarioType) {
    let message = '';
    if (scenarioType === 'sf') {
        message = '警告：精神負荷が臨界点に達しました。<br>これ以上のマトリクスへの接続は、あなたの精神崩壊を招きます。<br>ネットワークへの再アクセスは、システムデイリーメンテナンス（毎日午前4時）の完了後に許可されます。';
    }else if (scenarioType === 'testS') {
                    message = 'お試しプレイありがとうございます！<br>広告を見ることでゲーム選択画面に戻ります。'; 
                }
    else {
        message = '夜の森を覆う呪いが、あなたの理性を蝕んでいく…<br>これ以上は危険だ。今は身を潜め、心を休めるしかない。<br>呪いが和らぐ夜明け（午前4時）と共に、再びあなたの道は開かれるだろう。';
    }
    adModalText.innerHTML = message;
    adModalOverlay.classList.add('visible');
}*/



export function highlightSlot(slotId) {
    if (!slotSelector) return;
    const option = slotSelector.querySelector(`option[value="${slotId}"]`);
    if (option) {
        slotSelector.value = slotId;
        slotSelector.classList.add('highlight');
        setTimeout(() => {
            slotSelector.classList.remove('highlight');
        }, 2000);
    }
}


export function showNextScenarioButton(onClick) {
    actionsContainer.innerHTML = '';
    
    const button = document.createElement('button');
    button.textContent = '次の物語へ進む（広告を見る）';
    button.className = 'next-scenario-button';
    button.addEventListener('click', onClick);
    
    // ★★★ 修正点：input-containerではなく、game-containerを基準にする ★★★
    const gameContainer = document.getElementById('game-container');
    gameContainer.appendChild(button);
}

/**
 * 広告通ったらこれにする。★★★ テストシナリオ完了ボタンを表示する新しい関数 ★★★
export function showNextScenarioButton(onClick) {
    // 既存の[ACTION]ボタンは全てクリアする
    actionsContainer.innerHTML = '';
    
    const button = document.createElement('button');
    button.textContent = '次の物語へ進む（広告を見る）';
    button.className = 'next-scenario-button'; // 新しいCSSクラスを適用
    button.addEventListener('click', onClick);
    
    // input-container内のactions-containerの上に追加する
    const inputContainer = document.getElementById('input-container');
    inputContainer.insertBefore(button, actionsContainer);
}*/


/**
 * i-mobileのPC用バナー広告を表示する
 */
export function showPcBannerAd() {
    // 広告を表示する「箱」を取得
    const adContainer = document.getElementById('imobile-ad-container');
    if (!adContainer) return; // 箱がなければ何もしない

    // 念のため、中身を一度空にする
    adContainer.innerHTML = '';

    // i-mobileから発行されたタグの情報を元に、要素をJavaScriptで組み立てる
    const adDiv = document.createElement('div');
    adDiv.id = 'im-2a5631435e204978a8d172b117fa1301'; // タグに書かれているdivのID

    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = 'https://imp-adedge.i-mobile.co.jp/script/v1/spot.js?20220104';

    const script2 = document.createElement('script');
    script2.text = `(window.adsbyimobile=window.adsbyimobile||[]).push({
        pid: 84078,
        mid: 587426,
        asid: 1912451,
        type: "banner",
        display: "inline",
        elementid: "im-2a5631435e204978a8d172b117fa1301"
    });`;

    // 組み立てた要素を「箱」の中に入れる
    adDiv.appendChild(script1);
    adDiv.appendChild(script2);
    adContainer.appendChild(adDiv);
}

/**
 * i-mobileのSP（スマホ）用バナー広告を表示する
 */
export function showSpBannerAd() {
    // 広告を表示する「箱」を取得
    const adContainer = document.getElementById('imobile-ad-container');
    if (!adContainer) return;

    // 中身を一度空にする
    adContainer.innerHTML = '';

    // ★スマホ用のタグ情報を元に、要素を組み立てる
    const adDiv = document.createElement('div');
    adDiv.id = 'im-e27a488b6ec3438b925176dbffddb97f'; // ★スマホ用のdiv ID

    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = 'https://imp-adedge.i-mobile.co.jp/script/v1/spot.js?20220104';

    const script2 = document.createElement('script');
    // ★スマホ用のID（pid, mid, asidなど）に書き換える
    script2.text = `(window.adsbyimobile=window.adsbyimobile||[]).push({
        pid: 84078,
        mid: 587427,
        asid: 1912452,
        type: "banner",
        display: "inline",
        elementid: "im-e27a488b6ec3438b925176dbffddb97f"
    });`;

    // 組み立てた要素を「箱」の中に入れる
    adDiv.appendChild(script1);
    adDiv.appendChild(script2);
    adContainer.appendChild(adDiv);
}