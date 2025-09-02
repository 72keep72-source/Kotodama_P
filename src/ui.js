import { calculateModifier } from './services/state.js';

// --- DOM要素の取得 ---
const gameLog = document.getElementById('game-log');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const statusDisplay = document.getElementById('status-display');
const actionCountDisplay = document.getElementById('action-count-display');
const actionsContainer = document.getElementById('actions-container');
const playerNameDisplay = document.getElementById('player-name-display');
const inventoryDisplay = document.getElementById('inventory-display');
const slotSelector = document.getElementById('slot-selector');
const scenarioSelectionContainer = document.getElementById('scenario-selection-container');
const hintToggleButton = document.getElementById('hint-toggle-button');
const adModalOverlay = document.getElementById('ad-modal-overlay');
const adConfirmButton = document.getElementById('ad-confirm-button');
const adCancelButton = document.getElementById('ad-cancel-button');
const adLoadingSpinner = document.getElementById('ad-loading-spinner');

// 各ステータスの説明文を定義
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
    if (className) p.classList.add(className);
    gameLog.appendChild(p);
    gameLog.scrollTop = gameLog.scrollHeight;
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
    
    // 1. プレースホルダー（初期選択肢）
    const placeholder = document.createElement('option');
    placeholder.textContent = 'データを選択してください';
    placeholder.value = ''; // valueを空にする
    slotSelector.appendChild(placeholder);

    // 2. 既存のセーブデータを追加
    if (gameSlots && gameSlots.length > 0) {
        gameSlots.forEach((slot, index) => {
            const option = document.createElement('option');
            option.value = slot.id;
            option.textContent = `データ${index + 1}: ${slot.name || '（名前未設定）'}`;
            slotSelector.appendChild(option);
        });
    }

    // 3. 「新規ゲーム」の選択肢を、空きスロットがあれば追加
    if (!maxSlots || gameSlots.length < maxSlots) {
        const newGameOption = document.createElement('option');
        newGameOption.textContent = '新規ゲームを始める';
        newGameOption.value = 'new_game';
        slotSelector.appendChild(newGameOption);
    }
    
    // 最後に選択していたスロットを復元
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

export function updateActionCountDisplay({ count }) {
    const limit = 20;
    actionCountDisplay.textContent = `${count || 0} / ${limit}`;
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
    gameLog.innerHTML = '';
    scenarioSelectionContainer.innerHTML = '';
    actionsContainer.innerHTML = '';
    updateAllDisplays({
        playerStats: {},
        modifiedStats: new Set(),
        dailyActions: { count: 0 },
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
        ? 'おかえりなさい、旅人よ。<br>冒険を再開、または新規に始めるには、ステータス欄上のプルダウンから選択して「決定」を押してください。'
        : 'ようこそ、「言霊のプロトコル」へ。<br>冒険を始めるには、ステータス欄上のプルダウンから「新規ゲームを始める」を選択してください。';
    
    addLog(welcomeMessage, 'ai-response');
    toggleInput(true, 'データを選択して「決定」してください');
}

export function showScenarioSelection(scenarioHandler) {
    clearGameScreen();
    // ★★★ ここをカッコいいメッセージに変更 ★★★
    const scenarioWelcomeMessage = '冷たい石の感触。失われた記憶。<br>あなたは石碑の前で倒れている。<br>ここが剣と魔法の世界なのか、AIが支配する未来なのか…<br>それすら、まだ決まってはいない。<br>すべては、あなたの最初の「言霊」から始まる。<br>▼ 始めたい物語を、下から選択してください。';
    addLog(scenarioWelcomeMessage, 'ai-response');
    toggleInput(true, '物語を選択してください');

    scenarioSelectionContainer.innerHTML = '';
    const scenarios = [
        { name: '剣と魔法の世界', type: 'fantasy', description: '呪われた森で失われた記憶の《コア》を探す、王道ファンタジー。' },
        { name: 'AIが管理する未来的な世界', type: 'sf', description: '巨大サイバー都市で失われた記憶《媒体》を探す、SFアドベンチャー。' }
    ];

    scenarios.forEach(scenario => {
        const card = document.createElement('div');
        card.className = 'scenario-card';
        card.innerHTML = `<h3>${scenario.name}</h3><p>${scenario.description}</p>`;
        card.onclick = () => {
            scenarioSelectionContainer.innerHTML = '';
            scenarioHandler(scenario.type);
        };
        scenarioSelectionContainer.appendChild(card);
    });
}

export function updateAllDisplays(gameState, changes = {}) {
    updatePlayerNameDisplay(gameState.playerName || '');
    updateStatusDisplay(gameState, changes);
    updateActionCountDisplay(gameState.dailyActions || { count: 0 });
    updateInventoryDisplay(gameState.inventory || []);
}

export function exportLogToFile(activeSlotId, playerName) {
    if (!activeSlotId) {
        alert('エクスポートするゲームデータがありません。');
        return;
    }
    const logText = gameLog.innerText;
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date();
    const formattedDate = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    a.download = `${playerName || 'log'}_${formattedDate}.txt`;
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
            actionsContainer.classList.add('visible');
        } else {
            hintToggleButton.textContent = 'ヒントを表示';
            hintToggleButton.classList.remove('active');
            actionsContainer.classList.remove('visible');
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
}

export function showAdModal() {
    adModalOverlay.classList.add('visible');
}
