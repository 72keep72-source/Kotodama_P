// 各モジュールから必要な機能をインポート
import * as state from './services/state.js';
import * as ui from './ui.js';
import { callAI } from './services/api.js';
import { RULEBOOK as RULEBOOK_1ST } from './assets/data/rulebook_1st.js';
import { RULEBOOK_SF_AI } from './assets/data/rulebook_SF_AI.js';


// --- グローバルDOM要素 (ランディングページ用) ---
const landingPage = document.getElementById('landing-page');
const startGameButton = document.getElementById('start-game-button');
const gameWrapper = document.getElementById('game-wrapper');

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

    const currentHistory = state.getGameState().conversationHistory;
    if (!currentHistory || !Array.isArray(currentHistory) || currentHistory.length === 0) {
        console.error("API呼び出し前に不正な会話履歴が検出されました:", currentHistory);
        ui.updateThinkingMessage('エラーが発生しました: 送信する会話履歴がありません。');
        ui.toggleInput(false);
        return; 
    }

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
        ui.showTemporaryMessage('「決定」ボタンで新しい冒険を開始するか、続きを遊ぶデータを選択してください。');
        return;
    }
    const command = commandFromButton || userInput.value.trim();
    if (command === '') return;

    if (!state.hasActionsLeft()) {
        ui.showAdModal(state.getGameState().activeScenarioType);
        return;
    }
    
    state.decrementActions();
    ui.updateActionCountDisplay(state.getGameState().dailyActions);
    
    ui.addLog(`> ${command}`, 'user-command');
    ui.clearInput();
    ui.clearActions();
    state.addHistory({ role: 'user', parts: [{ text: command }] });

    await processAIturn();
}

/** 新しいゲームを開始する */
function startNewGame(scenarioType) {
    if (state.getGameState().gameSlots.length >= state.MAX_SAVE_SLOTS) {
        ui.showTemporaryMessage(`セーブスロットは${state.MAX_SAVE_SLOTS}つまでです。`);
        return;
    }
    const rulebook = scenarioType === 'sf' ? RULEBOOK_SF_AI : RULEBOOK_1ST;
    
    const newGameState = state.createNewGame(rulebook, scenarioType);
    
    ui.clearGameScreen();
    ui.updateAllDisplays(newGameState);
    ui.updateSlotSelector({
        gameSlots: state.getGameState().gameSlots,
        maxSlots: state.MAX_SAVE_SLOTS
    });
    ui.toggleInput(false);

    processAIturn();
}

/** セーブデータからゲームをロードする */
function loadGameFromSlot(slotId) {
    const gameState = state.loadGame(slotId);
    if (!gameState) {
        // ロードに失敗した場合はウェルカム画面に戻すのが安全
        ui.showWelcomeScreen(state.getGameState().gameSlots.length > 0);
        return;
    }
    
    ui.clearGameScreen();
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
        ui.showTemporaryMessage('削除するセーブデータを選択してください。');
        return;
    }
    const slotToDelete = state.getGameState().gameSlots.find(s => s.id == selectedId);
    if (confirm(`本当にセーブデータ「${slotToDelete.name}」を削除しますか？`)) {
        state.deleteSlot(selectedId);
        window.location.reload();
    }
}

// --- 初期化とイベントリスナー ---

/** ゲーム画面が表示された後、最初に行う初期化処理 */
function initializeGame() {
    state.loadGameSlotsFromStorage();
    const gameState = state.getGameState();
    ui.updateSlotSelector({ 
        gameSlots: gameState.gameSlots, 
        maxSlots: state.MAX_SAVE_SLOTS 
    });

    const hasSaveData = gameState.gameSlots.length > 0;
    ui.showWelcomeScreen(hasSaveData);
    
    ui.initializeHintButton();
    ui.initializeAdModal((onSuccess) => {
        setTimeout(() => {
            state.recoverActions(5);
            ui.updateActionCountDisplay(state.getGameState().dailyActions);
            ui.addLog('【システム】行動回数が5回分回復しました。', 'ai-response');
            onSuccess();
        }, 2000);
    });

    // ゲーム画面専用のイベントリスナーをここで設定
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
        // ★★★ 既存データがあるかどうかをチェック ★★★
        const hasSaveData = state.getGameState().gameSlots.length > 0;

        if (selectedValue === 'new_game') {
            // ★★★ 既存データがあるかどうかを引数で渡す ★★★
            ui.showScenarioSelection(startNewGame, hasSaveData);
        } else if (selectedValue && state.getGameState().gameSlots.some(s => s.id == selectedValue)) {
            state.setActiveSlotId(selectedValue);
            loadGameFromSlot(selectedValue);
        } else {
            ui.showTemporaryMessage('プルダウンからロードするセーブデータ、または「新規ゲームを始める」を選択してください。');
        }
    });
    deleteSlotButton.addEventListener('click', deleteSelectedSlot);
    exportLogButton.addEventListener('click', () => {
        const { activeSlotId, playerName } = state.getGameState();
        ui.exportLogToFile(activeSlotId, playerName);
    });
}

/** ページの読み込みが完了したら、まずこの処理が実行される */
document.addEventListener('DOMContentLoaded', () => {
    // ランディングページがなければ何もしない
    if (!landingPage || !startGameButton || !gameWrapper) {
        console.warn("ランディングページの要素が見つからないため、ゲームを直接初期化します。");
        document.body.classList.add('game-active');
        initializeGame();
        return;
    }

    // 「ゲームを開始する」ボタンがクリックされた時の処理だけを設定
    startGameButton.addEventListener('click', () => {
        document.body.classList.add('game-active');
        // ゲーム画面が表示されてから、ゲームの初期化処理を呼び出す
        initializeGame(); 
    });
});

