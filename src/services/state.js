// --- 定数 ---
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

// --- 状態取得関数 ---
export function getGameState() {
    return {
        gameSlots, activeSlotId, conversationHistory, playerStats,
        dailyActions, playerName, inventory, modifiedStats
    };
}
export function getActiveSlotId() { return activeSlotId; }

// --- 状態更新関数 ---
export function addHistory(turn) {
    conversationHistory.push(turn);
}

export function setActiveSlotId(id) {
    activeSlotId = id;
    localStorage.setItem('rpgActiveSlotId', activeSlotId);
}

// --- 主要ロジック ---

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

export function loadGame(slotId) {
    const slot = gameSlots.find(s => s.id == slotId);
    if (!slot) return null;
    
    activeSlotId = slot.id;
    conversationHistory = slot.history || [];
    playerStats = slot.stats || {};
    dailyActions = slot.actions || { date: '', count: 0 };
    playerName = slot.name || '（名前未設定）';
    inventory = slot.inventory || [];
    modifiedStats = new Set(slot.modified || []);

    return getGameState();
}

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
    return newSlot;
}

export function deleteSlot(slotId) {
    gameSlots = gameSlots.filter(s => s.id != slotId);
    activeSlotId = null;
    saveCurrentSlotToStorage();
}

export function isActionLimitReached() {
    const today = new Date().toISOString().slice(0, 10);
    if (dailyActions.date !== today) {
        dailyActions.date = today;
        dailyActions.count = 0;
        return false;
    }
    return dailyActions.count >= DAILY_ACTION_LIMIT;
}

export function incrementDailyActions() {
    dailyActions.count++;
}


// --- 補助関数 ---

export function calculateModifier(statValue) {
    const modifier = Math.floor((statValue - 10) / 2);
    if (modifier === 0) return "";
    return modifier > 0 ? `+${modifier}` : `${modifier}`;
}

function generateStats() {
    const rollDice = () => Math.floor(Math.random() * 16) + 3;
    const initialHP = 100;
    return { "HP": { current: initialHP, max: initialHP }, "STR": rollDice(), "DEX": rollDice(), "CON": rollDice(), "INT": rollDice(), "WIS": rollDice(), "CHA": rollDice() };
}

export function parseAIResponse(fullAiText) {
    let storyText = fullAiText;
    const statChanges = {};

    const nameMatch = storyText.match(/\[NAME\]\s*(.+)/);
    if (nameMatch) {
        playerName = nameMatch[1].trim();
        storyText = storyText.replace(/\[NAME\].+/, '').trim();
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
            const oldValue = playerStats[stat];
            if (operator === '+') playerStats[stat] += value;
            else if (operator === '-') playerStats[stat] -= value;
            else playerStats[stat] = value;
            
            const diff = playerStats[stat] - oldValue;
            if (diff !== 0) statChanges[stat] = diff > 0 ? `+${diff}` : `${diff}`;
            modifiedStats.add(stat);
        }
    }
    storyText = storyText.replace(statRegex, '').trim();

    const itemAddRegex = /\[ITEM_ADD\]\s*(.+)/g;
    while(storyText.match(itemAddRegex)) {
        const item = storyText.match(itemAddRegex)[1].trim();
        if (inventory.length < MAX_INVENTORY_SIZE) inventory.push(item);
        storyText = storyText.replace(itemAddRegex, '').trim();
    }
    
    const itemRemoveRegex = /\[ITEM_REMOVE\]\s*(.+)/g;
    while(storyText.match(itemRemoveRegex)) {
        const itemToRemove = storyText.match(itemRemoveRegex)[1].trim();
        inventory = inventory.filter(item => item !== itemToRemove);
        storyText = storyText.replace(itemRemoveRegex, '').trim();
    }

    const lines = storyText.split('\n');
    const storyLogText = lines.filter(line => !line.startsWith('[ACTION]')).join('\n').trim();
    const actions = lines.filter(line => line.startsWith('[ACTION]')).map(line => line.replace('[ACTION] ', ''));

    return { storyLogText, actions, statChanges };
}
