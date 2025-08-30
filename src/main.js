// 各モジュールから必要な機能をインポート
import * as state from './services/state.js';
import * as ui from './ui.js';
import { callAI } from './services/api.js';
import { RULEBOOK as RULEBOOK_1ST } from './assets/data/rulebook_1st.js';
import { RULEBOOK_SF_AI } from './assets/data/rulebook_SF_AI.js';


// --- DOM要素の取得 ---
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const confirmButton = document.getElementById('confirm-button');
const deleteSlotButton = document.getElementById('delete-slot-button');
const slotSelector = document.getElementById('slot-selector');
const exportLogButton = document.getElementById('export-log-button');

// --- ゲームロジック ---

/** AIとの対話処理をまとめた関数 */
async function processAIturn() {
    ui.addLog('考え中...', 'ai-response');
    ui.toggleInput(true, 'AIが応答を考えています…');

    try {
        const fullAiText = await callAI(state.getGameState().conversationHistory);
        state.addHistory({ role: 'model', parts: [{ text: fullAiText }] });
        const parsedData = state.parseAIResponse(fullAiText);

        ui.updateThinkingMessage(parsedData.storyLogText);
        ui.displayActions(parsedData.actions, handleUserCommand);
        ui.updateAllDisplays(state.getGameState(), parsedData.statChanges);
        state.saveCurrentSlotToStorage();
    } catch (error) {
        ui.updateThinkingMessage('エラーが発生しました: ' + error.message);
    } finally {
        ui.toggleInput(false);
    }
}


/** ユーザーのコマンドを処理 */
async function handleUserCommand(commandFromButton = null) {
    if (!state.getActiveSlotId()) {
        alert('「決定」ボタンで新しい冒険を開始するか、続きを遊ぶデータを選択してください。');
        return;
    }
    const command = commandFromButton || userInput.value.trim();
    if (command === '') return;

    if (state.isActionLimitReached()) {
        ui.addLog('本日の行動回数上限に達しました。また明日、冒険を続けてください。', 'ai-response');
        return;
    }

    ui.addLog('> ' + command, 'user-command');
    ui.clearInput();
    ui.clearActions();
    state.incrementDailyActions();
    state.addHistory({ role: 'user', parts: [{ text: command }] });
    ui.updateActionCountDisplay(state.getGameState().dailyActions);

    await processAIturn();
}

/** 新しいゲームを作成 */
function createNewGame(selectedRulebook) {
    if (state.getGameState().gameSlots.length >= state.MAX_SAVE_SLOTS) {
        alert(`セーブスロットは${state.MAX_SAVE_SLOTS}つまでです。`);
        return;
    }
    const newSlot = state.createNewSlot(selectedRulebook);
    loadGame(newSlot.id);
    ui.updateSlotSelector(state.getGameState());
    
    processAIturn(); // AIの最初の応答を待つ
}

/** ★ シナリオを選択して新しいゲームを開始するハンドラ */
function handleScenarioSelection(scenarioType) {
    const rulebook = scenarioType === 'sf' ? RULEBOOK_SF_AI : RULEBOOK_1ST;
    createNewGame(rulebook);
}

/** ゲームデータをロード */
function loadGame(slotId) {
    ui.clearGameScreen();
    const gameState = state.loadGame(slotId);
    if (!gameState) {
        initializeGame(); // ロードに失敗したら初期画面へ
        return;
    }
    
    ui.rebuildLog(gameState.conversationHistory);
    const lastTurn = gameState.conversationHistory[gameState.conversationHistory.length - 1];
    if (lastTurn && lastTurn.role === 'model') {
        const parsedData = state.parseAIResponse(lastTurn.parts[0].text);
        ui.displayActions(parsedData.actions, handleUserCommand);
    }
    ui.updateAllDisplays(gameState);
    ui.toggleInput(false);
}

/** 選択されたスロットを削除 */
function deleteSelectedSlot() {
    const selectedId = slotSelector.value;
    if (!selectedId || !state.getGameState().gameSlots.some(s => s.id == selectedId)) {
        alert('削除するセーブデータを選択してください。');
        return;
    }
    const slotToDelete = state.getGameState().gameSlots.find(s => s.id == selectedId);
    if (confirm(`本当にセーブデータ「${slotToDelete.name}」を削除しますか？`)) {
        state.deleteSlot(selectedId);
        window.location.reload();
    }
}

// --- 初期化とイベントリスナー ---

/** ゲームの初期化 */
function initializeGame() {
    state.loadGameSlotsFromStorage();
    ui.updateSlotSelector(state.getGameState());
    const isSlotFull = state.getGameState().gameSlots.length >= state.MAX_SAVE_SLOTS;
    ui.showWelcomeScreen(isSlotFull, handleScenarioSelection);
    ui.initializeHintButton(); // ★ヒントボタンを初期化
}

// イベントリスナーを設定
sendButton.addEventListener('click', () => handleUserCommand());
userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        handleUserCommand();
    }
});
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = (userInput.scrollHeight) + 'px';
});

confirmButton.addEventListener('click', () => {
    const selectedValue = slotSelector.value;
    // ★「新規ゲーム」はシナリオ選択画面に移行したため、ここでの処理は不要に
    if (selectedValue) {
        state.setActiveSlotId(selectedValue);
        loadGame(selectedValue);
    } else {
        alert('プルダウンからロードするデータを選択してください。');
    }
});

deleteSlotButton.addEventListener('click', deleteSelectedSlot);

exportLogButton.addEventListener('click', () => {
    const { activeSlotId, playerName } = state.getGameState();
    ui.exportLogToFile(activeSlotId, playerName);
});

// DOMの読み込み完了時にゲームを初期化
document.addEventListener('DOMContentLoaded', initializeGame);

