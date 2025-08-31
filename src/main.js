// 各モジュールから必要な機能をインポート
import * as state from './services/state.js';
import * as ui from './ui.js';
import { callAI } from './services/api.js';
// ★★★ パスを修正 ★★★
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

    if (state.checkAndResetActions()) {
        ui.showAdModal();
        return;
    }

    state.incrementDailyActions();
    ui.updateActionCountDisplay(state.getGameState().dailyActions);
    
    ui.addLog(`> ${command}`, 'user-command');
    ui.clearInput();
    ui.clearActions();
    state.addHistory({ role: 'user', parts: [{ text: command }] });

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
    
    processAIturn();
}

/** シナリオを選択して新しいゲームを開始するハンドラ */
function handleScenarioSelection(scenarioType) {
    const rulebook = scenarioType === 'sf' ? RULEBOOK_SF_AI : RULEBOOK_1ST;
    createNewGame(rulebook);
}

/** ゲームデータをロード */
function loadGame(slotId) {
    const gameState = state.loadGame(slotId);
    if (!gameState) {
        ui.showWelcomeScreen(state.getGameState().gameSlots.length > 0, state.getGameState().gameSlots.length >= state.MAX_SAVE_SLOTS, handleScenarioSelection);
        return;
    }
    
    ui.clearGameScreen();
    
    state.checkAndResetActions();
    ui.updateAllDisplays(gameState);
    
    ui.rebuildLog(gameState.conversationHistory);
    const lastTurn = gameState.conversationHistory[gameState.conversationHistory.length - 1];
    if (lastTurn && lastTurn.role === 'model') {
        const parsedData = state.parseAIResponse(lastTurn.parts[0].text);
        ui.displayActions(parsedData.actions, handleUserCommand);
    }
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
    const gameState = state.getGameState();
    ui.updateSlotSelector(gameState);

    const hasSaveData = gameState.gameSlots.length > 0;
    const isSlotFull = gameState.gameSlots.length >= state.MAX_SAVE_SLOTS;
    ui.showWelcomeScreen(hasSaveData, isSlotFull, handleScenarioSelection);
    
    ui.initializeHintButton();
    ui.initializeAdModal(() => {
        setTimeout(() => {
            state.recoverActions(5);
            ui.updateActionCountDisplay(state.getGameState().dailyActions);
            ui.addLog('【システム】行動回数が5回分回復しました。', 'ai-response');
        }, 3000);
    });
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

// 「決定」ボタンはロード専用
confirmButton.addEventListener('click', () => {
    const selectedValue = slotSelector.value;
    if (selectedValue && selectedValue !== 'new_game' && state.getGameState().gameSlots.some(s => s.id == selectedValue)) {
        state.setActiveSlotId(selectedValue);
        loadGame(selectedValue);
    } else if (selectedValue === 'new_game') {
        // この部分は handleScenarioSelection に任せるため、何もしないか、
        // シナリオ選択を促すメッセージを表示するのが親切です。
        ui.showWelcomeScreen(state.getGameState().gameSlots.length > 0, state.getGameState().gameSlots.length >= state.MAX_SAVE_SLOTS, handleScenarioSelection);
    }
    else {
        alert('プルダウンからロードするセーブデータを選択してください。');
    }
});

deleteSlotButton.addEventListener('click', deleteSelectedSlot);

exportLogButton.addEventListener('click', () => {
    const { activeSlotId, playerName } = state.getGameState();
    ui.exportLogToFile(activeSlotId, playerName);
});

// DOMの読み込み完了時にゲームを初期化
document.addEventListener('DOMContentLoaded', initializeGame);


