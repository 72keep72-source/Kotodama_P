// --- グローバル定数 ---
export const MAX_SAVE_SLOTS = 3;
const DAILY_RECOVERY = 20; // １日の回復量
const MAX_ACTIONS = 50;    // 行動回数の上限
const INITIAL_ACTIONS = 50; // 新規ゲーム開始時の行動回数
const RESET_HOUR_JST = 4; // JSTでのデイリーリセット時刻 (AM 4:00)

// --- ゲーム状態変数 ---
let gameSlots = [];
let activeSlotId = null;
let conversationHistory = [];
let playerStats = {};
let dailyActions = { lastUpdateTimestamp: 0, current: 0, limit: MAX_ACTIONS };
let playerName = '';
let inventory = [];
let modifiedStats = new Set();
let activeScenarioType = 'fantasy'; // デフォルト


/** JSTでの「最後のAM4時」のタイムスタンプを取得する */
function getLastResetTimestamp(timestamp) {
    const date = new Date(timestamp);
    const JST_OFFSET = 9 * 60 * 60 * 1000;
    const dateJst = new Date(date.getTime() + JST_OFFSET);

    let resetDate = new Date(Date.UTC(
        dateJst.getUTCFullYear(),
        dateJst.getUTCMonth(),
        dateJst.getUTCDate(),
        RESET_HOUR_JST, 0, 0, 0
    ));

    if (dateJst.getUTCHours() < RESET_HOUR_JST) {
        resetDate.setUTCDate(resetDate.getUTCDate() - 1);
    }
    
    return resetDate.getTime() - JST_OFFSET;
}

/** 行動回数計算ロジック */
function updateActionsOnLoad(savedActions) {
    const now = Date.now();
    let { lastUpdateTimestamp, current, limit } = savedActions;
    
    const lastReset = getLastResetTimestamp(lastUpdateTimestamp);
    const currentReset = getLastResetTimestamp(now);

    if (currentReset > lastReset) {
        const oneDay = 24 * 60 * 60 * 1000;
        const daysPassed = Math.floor((currentReset - lastReset) / oneDay);
        
        const recoveredAmount = daysPassed * DAILY_RECOVERY;
        current = Math.min(limit, current + recoveredAmount);
    }

    return { lastUpdateTimestamp: now, current, limit };
}


/** 現在のゲーム状態をオブジェクトとして取得する */
export function getGameState() {
    return {
        gameSlots, activeSlotId, conversationHistory, playerStats,
        dailyActions, playerName, inventory, modifiedStats, activeScenarioType
    };
}

export function getActiveSlotId() { return activeSlotId; }
export function setActiveSlotId(id) {
    activeSlotId = id;
    localStorage.setItem('rpgActiveSlotId', activeSlotId);
}

/** ステータス値から修正値を計算する */
export function calculateModifier(statValue) {
    const modifier = Math.floor((statValue - 10) / 2);
    if (modifier === 0) return "";
    return modifier > 0 ? `+${modifier}` : `${modifier}`;
}

// --- 主要関数 ---

export function loadGameSlotsFromStorage() {
    gameSlots = JSON.parse(localStorage.getItem('rpgGameSlots')) || [];
}

export function saveCurrentSlotToStorage() {
    const activeSlot = gameSlots.find(slot => slot.id == activeSlotId);
    if (activeSlot) {
        activeSlot.history = conversationHistory;
        activeSlot.stats = playerStats;
        activeSlot.actions = dailyActions;
        activeSlot.name = playerName;
        activeSlot.inventory = inventory;
        activeSlot.modified = Array.from(modifiedStats);
        activeSlot.scenarioType = activeScenarioType;
    }
    localStorage.setItem('rpgGameSlots', JSON.stringify(gameSlots));
}

/** 指定されたスロットIDのゲームデータを読み込む */
export function loadGame(slotId) {
    const slot = gameSlots.find(s => s.id == slotId);
    if (!slot) return null;

    activeSlotId = slot.id;
    
    conversationHistory = JSON.parse(JSON.stringify(slot.history || []));
    playerStats = JSON.parse(JSON.stringify(slot.stats || {}));
    dailyActions = updateActionsOnLoad(slot.actions || { lastUpdateTimestamp: Date.now(), current: DAILY_RECOVERY, limit: MAX_ACTIONS });
    playerName = slot.name || '（名前未設定）';
    inventory = JSON.parse(JSON.stringify(slot.inventory || []));
    modifiedStats = new Set(slot.modified || []);
    activeScenarioType = slot.scenarioType || 'fantasy';
    
    return getGameState();
}

/** 新しいゲームを作成し、その状態を返す */
export function createNewGame(rulebook, scenarioType) {
    const newSlot = {
        id: Date.now(),
        name: '（名前未設定）',
        stats: generateStats(),
        history: [],
        inventory: [],
        actions: { lastUpdateTimestamp: Date.now(), current: INITIAL_ACTIONS, limit: MAX_ACTIONS },
        modified: [],
        scenarioType: scenarioType
    };
    newSlot.history.push({
        role: 'user',
        parts: [{ text: rulebook + `\n\nあなたの能力値は ${JSON.stringify(newSlot.stats)} です。この情報も踏まえて、ゲームマスターとして、ルールに厳密に従ってゲームを開始してください。` }]
    });
    
    gameSlots.push(newSlot);
    activeSlotId = newSlot.id;
    
    loadGame(activeSlotId);
    
    saveCurrentSlotToStorage();
    return getGameState();
}

export function deleteSlot(slotId) {
    gameSlots = gameSlots.filter(s => s.id != slotId);
    if (activeSlotId == slotId) {
        activeSlotId = null;
        localStorage.removeItem('rpgActiveSlotId');
    }
    saveCurrentSlotToStorage();
}

/** AI応答を解析し、ゲームの状態を更新する */
export function parseAIResponse(fullAiText) {
    let storyText = fullAiText;
    const statChanges = {};

    const nameMatch = storyText.match(/\[NAME\]\s*(.+)/);
    if (nameMatch) {
        playerName = nameMatch[1].trim();
        const activeSlot = gameSlots.find(slot => slot.id == activeSlotId);
        if (activeSlot) activeSlot.name = playerName;
    }

    const statRegex = /\[STAT\]\s*(\w+)\s*([+\-]?)\s*(\d+)/g;
    let statMatch;
    while ((statMatch = statRegex.exec(storyText)) !== null) {
        const [_, stat, operator, valueStr] = statMatch;
        const value = parseInt(valueStr, 10);
        
        if (playerStats && typeof playerStats[stat] === 'number') {
            const oldValue = playerStats[stat];
            if (operator === '+') playerStats[stat] += value;
            else if (operator === '-') playerStats[stat] -= value;
            else playerStats[stat] = value;
            const diff = playerStats[stat] - oldValue;
            if (diff !== 0) statChanges[stat] = diff > 0 ? `+${diff}` : `${diff}`;
        }
    }
    storyText = storyText.replace(statRegex, '').trim();
    
    const damageRegex = /\[DAMAGE\]\s*(\d+)/g;
    let damageMatch;
    while ((damageMatch = damageRegex.exec(storyText))) {
        if (playerStats.HP) {
            const damage = parseInt(damageMatch[1], 10);
            playerStats.HP.current -= damage;
            if (playerStats.HP.current < 0) playerStats.HP.current = 0;
        }
    }
    storyText = storyText.replace(damageRegex, '').trim();

    const healRegex = /\[HEAL\]\s*(\d+)/g;
    let healMatch;
    while ((healMatch = healRegex.exec(storyText))) {
        if (playerStats.HP) {
            const heal = parseInt(healMatch[1], 10);
            playerStats.HP.current += heal;
            if (playerStats.HP.current > playerStats.HP.max) playerStats.HP.current = playerStats.HP.max;
        }
    }
    storyText = storyText.replace(healRegex, '').trim();

    const itemAddRegex = /\[ITEM_ADD\]\s*(.+)/g;
    let itemAddMatch;
    while((itemAddMatch = itemAddRegex.exec(storyText)) !== null) {
        if (inventory.length < 5) inventory.push(itemAddMatch[1].trim());
    }
    storyText = storyText.replace(itemAddRegex, '').trim();
    
    const itemRemoveRegex = /\[ITEM_REMOVE\]\s*(.+)/g;
    let itemRemoveMatch;
    while((itemRemoveMatch = itemRemoveRegex.exec(storyText)) !== null) {
        inventory = inventory.filter(item => item !== itemRemoveMatch[1].trim());
    }
    storyText = storyText.replace(itemRemoveRegex, '').trim();

    const lines = storyText.split('\n');
    const storyLogText = lines.filter(line => !line.startsWith('[ACTION]')).join('\n').trim();
    const actions = lines.filter(line => line.startsWith('[ACTION]')).map(line => line.replace('[ACTION] ', ''));

    return { storyLogText, actions, statChanges };
}

/** 初期ステータスを生成する */
function generateStats() {
    const roll3d6 = () => (Math.floor(Math.random() * 6) + 1) + (Math.floor(Math.random() * 6) + 1) + (Math.floor(Math.random() * 6) + 1);
    const initialHP = 100;
    return { "HP": { current: initialHP, max: initialHP }, "STR": roll3d6(), "DEX": roll3d6(), "CON": roll3d6(), "INT": roll3d6(), "WIS": roll3d6(), "CHA": roll3d6() };
}

/** 行動回数が残っているかチェック */
export function hasActionsLeft() {
    dailyActions = updateActionsOnLoad(dailyActions);
    return dailyActions.current > 0;
}

export function recoverActions(amount) {
    dailyActions.current = Math.min(MAX_ACTIONS, dailyActions.current + amount);
    saveCurrentSlotToStorage();
}

/** 行動回数を1減らす */
export function decrementActions() {
    if (dailyActions.current > 0) {
        dailyActions.current--;
    }
}

/** 会話履歴を追加する */
export function addHistory(turn) {
    conversationHistory.push(turn);
}

/** 現在のアクティブなセーブデータを取得する */
export function getActiveSlotData() {
    if (!activeSlotId) return null;
    return JSON.parse(JSON.stringify(gameSlots.find(slot => slot.id == activeSlotId)));
}

/** 外部のセーブデータをインポートする */
export function importSlot(importedSlot) {
    // IDが重複している場合は上書き
    const existingSlotIndex = gameSlots.findIndex(s => s.id == importedSlot.id);
    if (existingSlotIndex !== -1) {
        gameSlots[existingSlotIndex] = importedSlot;
        saveCurrentSlotToStorage();
        return { success: true, importedSlot };
    }
    
    // 新規スロットとして追加
    if (gameSlots.length >= MAX_SAVE_SLOTS) {
        return { success: false, reason: 'slot_full' };
    }

    gameSlots.push(importedSlot);
    saveCurrentSlotToStorage();
    return { success: true, importedSlot };
}

/** .txtファイルの内容から、新しいセーブデータスロットを作成する */
export function createSlotFromTxt(txtContent, rulebook) {
    const lines = txtContent.split('\n').filter(line => line.trim() !== '');
    
    let restoredHistory = [];
    let currentParts = [];
    let playerNameFromTxt = "";

    // ログからプレイヤー名を探す
    for (const line of lines) {
        const match = line.match(/^> (?:私の名前は「(.+?)」だ|(.+?)です)$/);
        if (match) {
            playerNameFromTxt = match[1] || match[2];
            break;
        }
    }
    if (!playerNameFromTxt) {
         playerNameFromTxt = "（TXTから）";
    }


    lines.forEach(line => {
        if (line.startsWith('> ')) {
            if (currentParts.length > 0) {
                restoredHistory.push({ role: 'model', parts: [{ text: currentParts.join('\n') }] });
                currentParts = [];
            }
            restoredHistory.push({ role: 'user', parts: [{ text: line.substring(2) }] });
        } else {
            currentParts.push(line);
        }
    });
    if (currentParts.length > 0) {
        restoredHistory.push({ role: 'model', parts: [{ text: currentParts.join('\n') }] });
    }

    // 会話の最初は必ず'user'でなければならないので、ルールブックを追加
    const initialUserTurn = {
        role: 'user',
        parts: [{ text: rulebook }] // ここではステータスを含めないのが安全
    };

    const finalHistory = [initialUserTurn, ...restoredHistory];

    const newSlot = {
        id: Date.now(),
        name: `${playerNameFromTxt}_txt`,
        stats: generateStats(),
        history: finalHistory,
        inventory: [], // txtからは復元不可
        actions: { lastUpdateTimestamp: Date.now(), current: INITIAL_ACTIONS, limit: MAX_ACTIONS },
        modified: [],
        scenarioType: 'fantasy' // TXTはファンタジー固定とする
    };

    return newSlot;
}

