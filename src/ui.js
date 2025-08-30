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
// ★ヒント機能用のDOM要素を作成
const hintButton = document.createElement('button');
hintButton.id = 'hint-toggle-button';
hintButton.textContent = 'ヒント';

// --- UI状態 ---
// ページ読み込み時にlocalStorageからヒントの表示状態を取得。なければ非表示(false)がデフォルト
let isHintVisible = localStorage.getItem('isHintVisible') === 'true';

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

/** ★ヒントボタンをページに追加し、イベントを設定する初期化関数 */
export function initializeHintButton() {
    const inputArea = document.getElementById('input-area');
    // input-areaの上(前)にヒントボタンを挿入
    inputArea.parentNode.insertBefore(hintButton, inputArea);
    hintButton.addEventListener('click', toggleHintVisibility);
    // 初期状態を反映
    updateHintButtonAndActionsContainer();
}

/** ★ヒントボタンが押された時に状態を切り替える関数 */
function toggleHintVisibility() {
    isHintVisible = !isHintVisible;
    localStorage.setItem('isHintVisible', isHintVisible); // 状態をlocalStorageに保存
    updateHintButtonAndActionsContainer();
}

/** ★ヒントボタンの見た目と、アクションコンテナの表示/非表示を更新する関数 */
function updateHintButtonAndActionsContainer() {
    hintButton.classList.toggle('active', isHintVisible);
    actionsContainer.style.display = isHintVisible ? 'block' : 'none';
}


export function addLog(text, className) {
    const p = document.createElement('p');
    p.textContent = text;
    if (className) p.classList.add(className);
    gameLog.appendChild(p);
    gameLog.scrollTop = gameLog.scrollHeight;
}

export function updateThinkingMessage(newText) {
    if (gameLog.lastChild && gameLog.lastChild.textContent === '考え中...') {
        gameLog.lastChild.textContent = newText;
    }
}

export function clearInput() {
    userInput.value = '';
    userInput.style.height = 'auto';
}

export function clearActions() {
    actionsContainer.innerHTML = '';
}

export function updateSlotSelector({ gameSlots }) {
    slotSelector.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.textContent = 'セーブデータを選択';
    placeholder.value = '';
    slotSelector.appendChild(placeholder);

    if (gameSlots.length === 0) {
        placeholder.textContent = 'セーブデータがありません';
    }

    gameSlots.forEach((slot, index) => {
        const option = document.createElement('option');
        option.value = slot.id;
        option.textContent = `データ${index + 1}: ${slot.name || '（名前未設定）'}`;
        slotSelector.appendChild(option);
    });

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
            setTimeout(() => { if(changeSpan.isConnected) changeSpan.remove(); }, 2000);
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
    updateHintButtonAndActionsContainer(); // アクションボタンが表示されたらヒントの状態も更新
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
        inventory: [] 
    });
}

export function rebuildLog(conversationHistory) {
    gameLog.innerHTML = '';
    (conversationHistory || []).slice(1).forEach(turn => {
        const text = turn.parts[0].text;
        if (turn.role === 'user') {
            addLog('> ' + text, 'user-command');
        } else {
            const storyText = text.split('\n').filter(line => !line.startsWith('[')).join('\n');
            addLog(storyText, 'ai-response');
        }
    });
}

/** ★ ゲーム開始前のウェルカム画面（シナリオ選択）を表示する */
export function showWelcomeScreen(isSlotFull, scenarioHandler) {
    clearGameScreen();
    
    addLog('ようこそ、「言霊のプロトコル」へ。', 'ai-response');

    if (isSlotFull) {
        addLog('▼ セーブデータがいっぱいです。新しい冒険を始めるには、サイドバーからデータを削除してください。', 'user-command');
        toggleInput(true, 'セーブデータがいっぱいです');
        return;
    }
    
    addLog('▼ 始めたい物語を選択するか、サイドバーから既存のデータをロードしてください。', 'user-command');
    toggleInput(true, 'プレイしたい世界を選択してください');

    scenarioSelectionContainer.innerHTML = '';

    const scenarios = [
        { name: '剣と魔法の世界', type: 'fantasy', description: '呪われた森で失われた記憶の《コア》を探す、王道ダークファンタジー。' },
        { name: 'AIが管理する未来的な世界', type: 'sf', description: 'AIに支配されたサイバー都市で、あなたは記憶媒体を取り戻せるか。' }
    ];

    scenarios.forEach(scenario => {
        const button = document.createElement('button');
        button.className = 'scenario-button';
        
        const title = document.createElement('span');
        title.className = 'scenario-title';
        title.textContent = scenario.name;
        
        const desc = document.createElement('span');
        desc.className = 'scenario-description';
        desc.textContent = scenario.description;

        button.appendChild(title);
        button.appendChild(desc);
        
        button.onclick = () => {
            scenarioSelectionContainer.innerHTML = ''; // ボタンを消す
            scenarioHandler(scenario.type); // main.jsのハンドラを呼び出す
        };
        scenarioSelectionContainer.appendChild(button);
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
    const formattedDate = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    a.download = `${playerName || 'log'}_${formattedDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

