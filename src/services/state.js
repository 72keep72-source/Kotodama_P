// --- グローバル定数 ---
export const MAX_SAVE_SLOTS = 3;
const DAILY_ACTION_LIMIT = 20;
const MAX_INVENTORY_SIZE = 5;


// --- ゲーム状態変数 ---
let gameSlots = [];
let activeSlotId = null;
let conversationHistory = [];
let playerStats = {};
let dailyActions = { date: '', count: 0 };
let playerName = '';
let inventory = [];
let modifiedStats = new Set();

/**
 * 現在のゲーム状態をオブジェクトとして取得する
 */
export function getGameState() {
    return {
        gameSlots,
        activeSlotId,
        conversationHistory,
        playerStats,
        dailyActions,
        playerName,
        inventory,
        modifiedStats
    };
}

export function getActiveSlotId() {
    return activeSlotId;
}

export function setActiveSlotId(id) {
    activeSlotId = id;
    localStorage.setItem('rpgActiveSlotId', activeSlotId);
}


/** ステータス値から修正値を計算する (D&D 5e準拠) */
export function calculateModifier(statValue) {
    const modifier = Math.floor((statValue - 10) / 2);
    if (modifier === 0) return "";
    return modifier > 0 ? `+${modifier}` : `${modifier}`;
}

// --- 主要関数 ---

/** localStorageから全セーブデータを読み込む */
export function loadGameSlotsFromStorage() {
    gameSlots = JSON.parse(localStorage.getItem('rpgGameSlots')) || [];
    // activeSlotIdはここでは読み込まない。起動時の選択を優先するため。
}

/** 現在のゲーム状態をlocalStorageに保存する */
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

/** 指定されたスロットIDのゲームデータを読み込んで画面を更新する */
export function loadGame(slotId) {
    const slot = gameSlots.find(s => s.id == slotId);
    if (!slot) {
        return null;
    }
    activeSlotId = slot.id;
    conversationHistory = slot.history || [];
    playerStats = slot.stats || {};
    dailyActions = slot.actions || { date: '', count: 0 };
    playerName = slot.name || '（名前未設定）';
    inventory = slot.inventory || [];
    modifiedStats = new Set(slot.modified || []);
    return getGameState();
}


/** 新しいスロットを作成して返す */
export function createNewSlot(rulebook) {
     const newSlot = {
        id: Date.now(),
        name: '（名前未設定）',
        stats: generateStats(),
        history: [],
        inventory: [],
        actions: { date: new Date().toISOString().slice(0, 10), count: 0 },
        modified: []
    };
    newSlot.history.push({
        role: 'user',
        parts: [{ text: rulebook + `\n\nあなたの能力値は ${JSON.stringify(newSlot.stats)} です。この情報も踏まえて、ゲームマスターとして、ルールに厳密に従ってゲームを開始してください。` }]
    });
    gameSlots.push(newSlot);
    activeSlotId = newSlot.id;
    saveCurrentSlotToStorage();
    return newSlot;
}


/** 選択されたセーブスロットを削除する */
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

    // ★ プレイヤー名が確定したら、セーブスロットの名前も更新するように修正
    const nameMatch = storyText.match(/\[NAME\]\s*(.+)/);
    if (nameMatch) {
        playerName = nameMatch[1].trim();
        storyText = storyText.replace(/\[NAME\].+/, '').trim();
        const activeSlot = gameSlots.find(slot => slot.id == activeSlotId);
        if (activeSlot) activeSlot.name = playerName;
    }

    const statRegex = /\[STAT\]\s*(\w+)\s*([+\-]?)\s*(\d+)/g;
    let statMatch;
    while ((statMatch = statRegex.exec(storyText)) !== null) {
        const [_, stat, operator, valueStr] = statMatch;
        const value = parseInt(valueStr, 10);
        
        if (stat === 'HP' && playerStats.HP) {
            if (!operator) playerStats.HP.current = value;
            else if (operator === '+') playerStats.HP.current += value;
            else if (operator === '-') playerStats.HP.current -= value;
            
            if(playerStats.HP.current > playerStats.HP.max) playerStats.HP.current = playerStats.HP.max;
            if(playerStats.HP.current < 0) playerStats.HP.current = 0;
        } 
        else if (playerStats && typeof playerStats[stat] === 'number') {
            if (operator === '+') {
                playerStats[stat] += value;
                statChanges[stat] = `+${value}`;
            } else if (operator === '-') {
                playerStats[stat] -= value;
                statChanges[stat] = `-${value}`;
            } else {
                const oldValue = playerStats[stat];
                playerStats[stat] = value;
                const diff = value - oldValue;
                if (diff !== 0) statChanges[stat] = diff > 0 ? `+${diff}` : `${diff}`;
            }
        }
    }
    storyText = storyText.replace(statRegex, '').trim();

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
    const roll3d6 = () => {
        return (Math.floor(Math.random() * 6) + 1) + (Math.floor(Math.random() * 6) + 1) + (Math.floor(Math.random() * 6) + 1);
    };
    const initialHP = 100;
    return { "HP": { current: initialHP, max: initialHP }, "STR": roll3d6(), "DEX": roll3d6(), "CON": roll3d6(), "INT": roll3d6(), "WIS": roll3d6(), "CHA": roll3d6() };
}

/** 行動回数が上限に達したかチェック */
export function isActionLimitReached() {
    const today = new Date().toISOString().slice(0, 10);
    if (dailyActions && dailyActions.date !== today) {
        dailyActions.date = today;
        dailyActions.count = 0;
    }
    return dailyActions.count >= DAILY_ACTION_LIMIT;
}

/** 行動回数を1増やす */
export function incrementDailyActions() {
    dailyActions.count++;
}

/** 会話履歴を追加する */
export function addHistory(turn) {
    conversationHistory.push(turn);
}

