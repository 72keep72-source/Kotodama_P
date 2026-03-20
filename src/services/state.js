/**
 * state.js
 * ゲームの全ての状態（セーブデータ、プレイヤー情報など）を管理する、言わば「金庫番」です。
 * データの読み込み、保存、更新は全てここが担当します。
 */

// --- グローバル定数 ---
export const MAX_SAVE_SLOTS = 3; // 最大セーブ数
const DAILY_RECOVERY = 20;      // １日の行動回数回復量
const MAX_ACTIONS = 50;         // 行動回数のストック上限
const INITIAL_ACTIONS = 50;     // 新規ゲーム開始時の行動回数
const RESET_HOUR_JST = 4;       // JSTでのデイリーリセット時刻 (AM 4:00)

// --- ゲーム状態を保持する変数 ---
// これらの変数が、ゲームの現在の状態を全て保持します。
let gameSlots = [];
let activeSlotId = null;
let conversationHistory = [];
let playerStats = {};
let dailyActions = { lastRecovery: 0, current: 0, limit: MAX_ACTIONS }; // ※lastUpdateTimestampからlastRecoveryに名称変更
let playerName = '';
let inventory = [];
let modifiedStats = new Set();
let activeScenarioType = 'fantasy';

/**
 * ページロード時に、最後の回復からの経過日数に応じて行動回数を回復させる関数
 * @param {object} savedDailyActions - 保存されていた dailyActions オブジェクト
 * @returns {object} - 更新された新しい dailyActions オブジェクト
 */
function recoverActionsOnLoad(savedDailyActions) {
    // 日本時間の午前4時を日付の区切りとするためのオフセット(ミリ秒)
    // Dateオブジェクトは標準時(UTC)で動くので、日本時間(JST)の午前4時は、UTCだと前日の19時。
    // その差を調整するための値です。
    const JST_OFFSET = 9 * 60 * 60 * 1000;
    const JST_RESET_HOUR_OFFSET = RESET_HOUR_JST * 60 * 60 * 1000;

    // タイムスタンプからリセット日の基準値（その日のJST午前4時のタイムスタンプ）を計算する内部関数
    const getLastResetTimestamp = (timestamp) => {
        const date = new Date(timestamp - JST_RESET_HOUR_OFFSET + JST_OFFSET);
        date.setUTCHours(0, 0, 0, 0);
        return date.getTime() + JST_RESET_HOUR_OFFSET - JST_OFFSET;
    };

    const now = Date.now();
    // 引数で受け取った保存データから、現在の値を取り出す
    let { current, limit, lastRecovery } = savedDailyActions;

    // 最後にリセットされた日と、今日のリセット日を比較
    const lastReset = getLastResetTimestamp(lastRecovery || 0);
    const currentReset = getLastResetTimestamp(now);

    // もし今日のリセット時刻が、最後の回復リセット時刻より後なら（＝日付が変わったなら）
    if (currentReset > lastReset) {
        // 経過日数を計算
        const oneDay = 24 * 60 * 60 * 1000;
        const daysPassed = Math.floor((currentReset - lastReset) / oneDay);
        
        // 経過日数 x 1日の回復量 を計算
        const recoveredAmount = daysPassed * DAILY_RECOVERY;
        
        // 回復量を加算する。ただし上限(limit)は超えないようにMath.minで制御
        current = Math.min(limit, current + recoveredAmount);
    }

    // 計算が終わった新しいオブジェクトを返す
    return {
        current: current,
        limit: limit,
        lastRecovery: now // 最終回復日時を「今」に更新
    };
}

/** 現在のゲーム状態をオブジェクトとして取得する */
export function getGameState() {
    return {
        gameSlots, activeSlotId, conversationHistory, playerStats,
        dailyActions, playerName, inventory, modifiedStats, activeScenarioType
    };
}

/**
 * 現在アクティブなスロットIDを取得する
 * @returns {number | null} アクティブなスロットのID
 */
export function getActiveSlotId() {
    return activeSlotId;
}

/**
 * アクティブなスロットIDを設定し、ローカルストレージにも保存する
 * @param {number} id - 新しくアクティブにするスロットのID
 */
export function setActiveSlotId(id) {
    activeSlotId = id;
    localStorage.setItem('rpgActiveSlotId', activeSlotId);
}


/**
 * ステータス値から、D&Dなどで使われる「修正値」を計算して文字列で返す
 * 例: 10 -> "", 12 -> "+1", 8 -> "-1"
 * @param {number} statValue - 計算元のステータス値
 * @returns {string} - 計算後の修正値文字列
 */
export function calculateModifier(statValue) {
    const modifier = Math.floor((statValue - 10) / 2);
    if (modifier === 0) return "";
    return modifier > 0 ? `+${modifier}` : `${modifier}`;
}

// --- 主要なセーブ・ロード処理 ---

/** ローカルストレージから全セーブデータを読み込む */
export function loadGameSlotsFromStorage() {
    gameSlots = JSON.parse(localStorage.getItem('rpgGameSlots')) || [];
}

/** 現在プレイ中のスロットのデータをローカルストレージに保存する */
export function saveCurrentSlotToStorage() {
    const activeSlot = gameSlots.find(slot => slot.id == activeSlotId);
    if (activeSlot) {
        // 現在のゲーム状態をアクティブなスロットデータに書き込む
        activeSlot.history = conversationHistory;
        activeSlot.stats = playerStats;
        activeSlot.dailyActions = dailyActions; // ★キーを「dailyActions」に統一
        activeSlot.name = playerName;
        activeSlot.inventory = inventory;
        activeSlot.modified = Array.from(modifiedStats);
        activeSlot.scenarioType = activeScenarioType;
    }
    // 全スロットデータをJSON形式でローカルストレージに保存
    localStorage.setItem('rpgGameSlots', JSON.stringify(gameSlots));
}

/** 指定されたスロットIDのゲームデータを読み込んで、現在のゲーム状態に反映させる */
export function loadGame(slotId) {
    const slot = gameSlots.find(s => s.id == slotId);
    if (!slot) return null;

    // --- ▼▼▼【重要】古いセーブデータ形式からの自動変換ロジック ▼▼▼ ---
    // もし新しい「dailyActions」がなく、古い「actions」が存在していたら…
    if (slot && !slot.dailyActions && slot.actions) {
        console.log('古い形式のセーブデータ(actions)を検出。新しい形式(dailyActions)に変換します。');
        // 古いactionsオブジェクトを新しいdailyActionsにコピー
        slot.dailyActions = { ...slot.actions }; 
        // 混乱を避けるため、古いactionsキーは削除
        delete slot.actions; 
    }
    // --- ▲▲▲ 自動変換ロジックここまで ▲▲▲ ---

    // 読み込んだスロットのデータを現在のゲーム状態変数にセットしていく
    activeSlotId = slot.id;
    conversationHistory = JSON.parse(JSON.stringify(slot.history || []));
    playerStats = JSON.parse(JSON.stringify(slot.stats || {}));
    
    // ★行動回数を、回復処理を通してからセットする
    dailyActions = recoverActionsOnLoad(slot.dailyActions || { lastRecovery: 0, current: INITIAL_ACTIONS, limit: MAX_ACTIONS });

    playerName = slot.name || '（名前未設定）';
    inventory = JSON.parse(JSON.stringify(slot.inventory || []));
    modifiedStats = new Set(slot.modified || []);
    activeScenarioType = slot.scenarioType || 'fantasy';
    
    // セットし終わった現在のゲーム状態を返す
    return getGameState();
}

/** 新しいゲームデータを作成して、その状態を返す */
export function createNewGame(rulebook, scenarioType) {
    const newSlot = {
        id: Date.now(),
        name: '（名前未設定）',
        stats: generateStats(),
        history: [],
        inventory: [],
        // ★キーを「dailyActions」に統一
        dailyActions: { lastRecovery: Date.now(), current: INITIAL_ACTIONS, limit: MAX_ACTIONS },
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
    let showAdButton = false; // ★テストシナリオ用フラグ

    // ★SHOW_AD_BUTTONタグをチェック
    if (storyText.includes('[SHOW_AD_BUTTON]')) {
        showAdButton = true;
        storyText = storyText.replace('[SHOW_AD_BUTTON]', '').trim();
    }

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
            const healAmount = parseInt(healMatch[1], 10);
            // 上限(max)を超えないように回復させる
            playerStats.HP.current = Math.min(playerStats.HP.max, playerStats.HP.current + healAmount);
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

    return { storyLogText, actions, statChanges, showAdButton }; // ★フラグを返す
}


/** 初期ステータスを生成する */
function generateStats() {
    const roll3d6 = () => (Math.floor(Math.random() * 6) + 1) + (Math.floor(Math.random() * 6) + 1) + (Math.floor(Math.random() * 6) + 1);
    const initialHP = 100;
    return { "HP": { current: initialHP, max: initialHP }, "STR": roll3d6(), "DEX": roll3d6(), "CON": roll3d6(), "INT": roll3d6(), "WIS": roll3d6(), "CHA": roll3d6() };
}

/** 行動回数が残っているかチェックする */
export function hasActionsLeft() {
    // 呼び出す関数名を、私たちが定義した正しい名前に修正します。
    dailyActions = recoverActionsOnLoad(dailyActions);
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
    const existingSlotIndex = gameSlots.findIndex(s => s.id == importedSlot.id);
    if (existingSlotIndex !== -1) {
        gameSlots[existingSlotIndex] = importedSlot;
        saveCurrentSlotToStorage();
        return { success: true, importedSlot };
    }
    
    if (gameSlots.length >= MAX_SAVE_SLOTS) {
        return { success: false, reason: 'slot_full' };
    }

    gameSlots.push(importedSlot);
    saveCurrentSlotToStorage();
    return { success: true, importedSlot };
}

/** TXTからセーブデータを生成する */
export function createSlotFromTxt(txtContent, fantasyRulebook, sfRulebook) {
    const lines = txtContent.split('\n');
    let extractedName = `(TXTから) ${new Date().toLocaleString('ja-JP')}`;
    
    // シナリオタイプを推測
    let detectedScenarioType = 'fantasy'; // デフォルトはファンタジー
    const sfKeywords = ['ネオ・TOKYO', 'コールサイン', 'マトリクス', '媒体'];
    if (sfKeywords.some(keyword => txtContent.includes(keyword))) {
        detectedScenarioType = 'sf';
    }
    
    const rulebook = detectedScenarioType === 'sf' ? sfRulebook : fantasyRulebook;
    const history = [{ role: 'user', parts: [{ text: rulebook }] }];

    lines.forEach(line => {
        if (line.startsWith('> ')) {
            history.push({ role: 'user', parts: [{ text: line.substring(2) }] });
        } else if (line.trim() !== '') {
            history.push({ role: 'model', parts: [{ text: line }] });
        }
    });

    const nameLine = lines.find(line => line.includes('良い名だ') || line.includes('登録完了'));
    if (nameLine) {
        const match = nameLine.match(/「(.+?)」/);
        if (match) extractedName = `${match[1]}_txt`;
    }

    return {
        id: Date.now(),
        name: extractedName,
        stats: generateStats(),
        history: history,
        inventory: [],
        actions: { lastUpdateTimestamp: Date.now(), current: INITIAL_ACTIONS, limit: MAX_ACTIONS },
        modified: [],
        scenarioType: detectedScenarioType // ★推測したシナリオタイプを設定
    };


}

// --- Export用ヘルパーここから ---

function formatExportDate(date = new Date()) {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

function sanitizeFileName(name = 'save') {
    return String(name).replace(/[\\/:*?"<>|]/g, '_').trim() || 'save';
}

function getExportBaseName(slot) {
    const safeName = sanitizeFileName(slot?.name || 'save');
    return `${safeName}_${formatExportDate()}`;
}

function stripControlTags(text = '') {
    return text
        .split('\n')
        .filter(line => !line.startsWith('['))
        .join('\n')
        .trim();
}

function extractRecentTurns(history, pairCount = 5) {
    const body = (history || []).slice(1); // 先頭のルール注入は除外
    const recent = [];
    let userCount = 0;

    for (let i = body.length - 1; i >= 0; i--) {
        const turn = body[i];
        if (!turn || !turn.parts || !turn.parts[0]) continue;
        recent.unshift(turn);

        if (turn.role === 'user') {
            userCount++;
            if (userCount >= pairCount) break;
        }
    }

    return recent;
}

function extractStateChanges(history) {
    const changes = [];

    (history || []).forEach(turn => {
        if (!turn || turn.role !== 'model' || !turn.parts || !turn.parts[0]) return;
        const text = turn.parts[0].text || '';

        const statRegex = /\[STAT\]\s*(\w+)\s*([+\-]?)\s*(\d+)/g;
        let statMatch;
        while ((statMatch = statRegex.exec(text)) !== null) {
            const [, stat, op, value] = statMatch;
            const label = op ? `${stat} ${op}${value}` : `${stat} = ${value}`;
            changes.push(`ステータス変化: ${label}`);
        }

        const damageRegex = /\[DAMAGE\]\s*(\d+)/g;
        let damageMatch;
        while ((damageMatch = damageRegex.exec(text)) !== null) {
            changes.push(`ダメージ: HP -${damageMatch[1]}`);
        }

        const itemAddRegex = /\[ITEM_ADD\]\s*(.+)/g;
        let itemAddMatch;
        while ((itemAddMatch = itemAddRegex.exec(text)) !== null) {
            changes.push(`アイテム入手: ${itemAddMatch[1].trim()}`);
        }

        const itemRemoveRegex = /\[ITEM_REMOVE\]\s*(.+)/g;
        let itemRemoveMatch;
        while ((itemRemoveMatch = itemRemoveRegex.exec(text)) !== null) {
            changes.push(`アイテム消費/喪失: ${itemRemoveMatch[1].trim()}`);
        }
    });

    // 長くなりすぎないように後ろだけ残す
    return changes.slice(-12);
}

function extractStorySummary(history) {
    const modelTexts = (history || [])
        .filter(turn => turn?.role === 'model' && turn?.parts?.[0]?.text)
        .map(turn => stripControlTags(turn.parts[0].text))
        .filter(Boolean);

    // 直近の物語本文だけを要約代わりに保持
    return modelTexts.slice(-8).join('\n\n').trim();
}

function buildCompactPrompt(slot) {
    const summary = slot.summary || {};
    const statsText = JSON.stringify(slot.stats || {}, null, 2);
    const inventoryText = (slot.inventory && slot.inventory.length > 0)
        ? slot.inventory.join('、')
        : 'なし';

    const dailyActionsText = slot.dailyActions
        ? `${slot.dailyActions.current} / ${slot.dailyActions.limit}`
        : '不明';

    const recentStateChanges = (summary.recentStateChanges || []).length > 0
        ? summary.recentStateChanges.map(v => `- ${v}`).join('\n')
        : '- 特になし';

    const storySoFar = summary.storySoFar || '要約なし';

    return [
        `あなたは「言霊のプロトコル」のゲームマスターです。`,
        `以下は軽量セーブデータから復元した再開用コンテキストです。`,
        `厳密な全文履歴ではなく、要約と直近会話をもとに自然に続行してください。`,
        ``,
        `【プレイヤー名】`,
        `${slot.name || '（名前未設定）'}`,
        ``,
        `【シナリオタイプ】`,
        `${slot.scenarioType || 'fantasy'}`,
        ``,
        `【現在ステータス】`,
        `${statsText}`,
        ``,
        `【所持品】`,
        `${inventoryText}`,
        ``,
        `【行動回数】`,
        `${dailyActionsText}`,
        ``,
        `【ここまでの物語要約】`,
        `${storySoFar}`,
        ``,
        `【最近の状態変化】`,
        `${recentStateChanges}`,
        ``,
        `この情報と、これに続く直近会話を踏まえてゲームを続けてください。`
    ].join('\n');
}

export function buildScenarioReviewText(slot) {
    if (!slot || !slot.history) return '';

    const lines = [];
    slot.history.slice(1).forEach(turn => {
        if (!turn || !turn.parts || !turn.parts[0]) return;
        const text = turn.parts[0].text || '';

        if (turn.role === 'user') {
            lines.push(`> ${text}`);
        } else if (turn.role === 'model') {
            const storyText = stripControlTags(text);
            if (storyText) lines.push(storyText);
        }
    });

    return lines.join('\n\n');
}

export function buildCompactSaveData(slot) {
    if (!slot) return null;

    const recentTurns = extractRecentTurns(slot.history || [], 5);
    const summary = {
        storySoFar: extractStorySummary(slot.history || []),
        recentStateChanges: extractStateChanges(slot.history || [])
    };

    const compactSlot = {
        id: slot.id,
        name: slot.name,
        stats: JSON.parse(JSON.stringify(slot.stats || {})),
        inventory: JSON.parse(JSON.stringify(slot.inventory || [])),
        dailyActions: JSON.parse(JSON.stringify(
            slot.dailyActions || { lastRecovery: Date.now(), current: 50, limit: 50 }
        )),
        modified: JSON.parse(JSON.stringify(slot.modified || [])),
        scenarioType: slot.scenarioType || 'fantasy',
        summary,
        recentTurns: JSON.parse(JSON.stringify(recentTurns))
    };

    // 既存のload/importに乗せやすいよう、軽量historyも持たせる
    compactSlot.history = [
        {
            role: 'user',
            parts: [{ text: buildCompactPrompt(compactSlot) }]
        },
        ...JSON.parse(JSON.stringify(recentTurns))
    ];

    return compactSlot;
}

export function getExportFileNames(slot) {
    const baseName = getExportBaseName(slot);
    return {
        txt: `${baseName}.txt`,
        json: `${baseName}_compact.json`
    };
}

export function convertFullSaveToCompactSave(importedData) {
    if (!importedData || !importedData.history) {
        throw new Error('有効な完全セーブデータではありません。');
    }

    return buildCompactSaveData(importedData);
}