// --- グローバル定数 ---
export const MAX_SAVE_SLOTS = 3;
const DAILY_ACTION_LIMIT = 20;
const MAX_INVENTORY_SIZE = 5;
const RESET_HOUR_JST = 4; // JSTでのデイリーリセット時刻 (AM 4:00)

// --- ゲーム状態変数 ---
let gameSlots = [];
let activeSlotId = null;
let conversationHistory = [];
let playerStats = {};
let dailyActions = { lastActionTimestamp: 0, count: 0 };
let playerName = '';
let inventory = [];
let modifiedStats = new Set();


/** JSTでの「最後のAM4時」のタイムスタンプを取得する */
function getLastResetTimestamp() {
    const now = new Date();
    const JST_OFFSET = 9 * 60 * 60 * 1000;
    const nowJst = new Date(now.getTime() + JST_OFFSET);

    let resetDate = new Date(Date.UTC(
        nowJst.getUTCFullYear(),
        nowJst.getUTCMonth(),
        nowJst.getUTCDate(),
        RESET_HOUR_JST, 0, 0, 0
    ));

    if (nowJst.getUTCHours() < RESET_HOUR_JST) {
        resetDate.setUTCDate(resetDate.getUTCDate() - 1);
    }
    
    return resetDate.getTime() - JST_OFFSET;
}

/** 現在のゲーム状態をオブジェクトとして取得する */
export function getGameState() {
    return {
        gameSlots, activeSlotId, conversationHistory, playerStats,
        dailyActions, playerName, inventory, modifiedStats
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
    }
    localStorage.setItem('rpgGameSlots', JSON.stringify(gameSlots));
}

/** 指定されたスロットIDのゲームデータを読み込む */
export function loadGame(slotId) {
    const slot = gameSlots.find(s => s.id == slotId);
    if (!slot) return null;

    activeSlotId = slot.id;
    conversationHistory = slot.history || [];
    playerStats = slot.stats || {};
    dailyActions = slot.actions.lastActionTimestamp ? slot.actions : { lastActionTimestamp: 0, count: 0 };
    playerName = slot.name || '（名前未設定）';
    inventory = slot.inventory || [];
    modifiedStats = new Set(slot.modified || []);
    
    return getGameState();
}

/** 新しいゲームを作成し、その状態を返す */
export function createNewGame(rulebook) {
     const newSlot = {
        id: Date.now(),
        name: '（名前未設定）',
        stats: generateStats(),
        history: [],
        inventory: [],
        actions: { lastActionTimestamp: Date.now(), count: 0 },
        modified: []
    };
    newSlot.history.push({
        role: 'user',
        parts: [{ text: rulebook + `\n\nあなたの能力値は ${JSON.stringify(newSlot.stats)} です。この情報も踏まえて、ゲームマスターとして、ルールに厳密に従ってゲームを開始してください。` }]
    });
    
    gameSlots.push(newSlot);
    activeSlotId = newSlot.id;
    
    // ★ 修正: グローバル変数を新しいスロットの状態に更新
    conversationHistory = newSlot.history;
    playerStats = newSlot.stats;
    dailyActions = newSlot.actions;
    playerName = newSlot.name;
    inventory = newSlot.inventory;
    modifiedStats = new Set(newSlot.modified);
    
    saveCurrentSlotToStorage();
    return getGameState();
}

export function deleteSlot(slotId) {
    gameSlots = gameSlots.filter(s => s.id != slotId);
    activeSlotId = null;
    saveCurrentSlotToStorage();
    localStorage.removeItem('rpgActiveSlotId');
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

    const itemAddRegex = /\[ITEM_ADD\]\s*(.+)/g;
    let itemAddMatch;
    while((itemAddMatch = itemAddRegex.exec(storyText)) !== null) {
        if (inventory.length < MAX_INVENTORY_SIZE) inventory.push(itemAddMatch[1].trim());
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

/** 行動回数が上限に達したかチェックし、必要ならリセットする */
export function checkAndResetActions() {
    const lastReset = getLastResetTimestamp();
    if (dailyActions.lastActionTimestamp < lastReset) {
        dailyActions.count = 0;
    }
    return dailyActions.count >= DAILY_ACTION_LIMIT;
}

export function recoverActions(amount) {
    dailyActions.count = Math.max(0, dailyActions.count - amount);
    saveCurrentSlotToStorage();
}

/** 行動回数を1増やし、タイムスタンプを更新する */
export function incrementDailyActions() {
    dailyActions.count++;
    dailyActions.lastActionTimestamp = Date.now();
}

/** 会話履歴を追加する */
export function addHistory(turn) {
    conversationHistory.push(turn);
}

