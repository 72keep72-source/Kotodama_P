// 各モジュールから必要な機能をインポート
import * as state from './services/state.js';
import * as ui from './ui.js';
import { callAI } from './services/api.js';
import { RULEBOOK as RULEBOOK_1ST } from './assets/data/rulebook_1st.js';
import { RULEBOOK_SF_AI } from './assets/data/rulebook_SF_AI.js';

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
    const userInput = document.getElementById('user-input'); 
    const command = commandFromButton || userInput.value.trim();
    if (command === '') return;

    if (!state.hasActionsLeft()) {
        ui.showAdModal(state.getGameState().scenarioType);
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
    const slotSelector = document.getElementById('slot-selector');
    const selectedId = slotSelector.value;
    if (!selectedId || !state.getGameState().gameSlots.some(s => s.id == selectedId)) {
        ui.showTemporaryMessage('削除するセーブデータを選択してください。');
        return;
    }
    const slotToDelete = state.getGameState().gameSlots.find(s => s.id == selectedId);
    if (confirm(`本当にセーブデータ「${slotToDelete.name}」を削除しますか？`)) {
        state.deleteSlot(selectedId);
        initializeGame(); 
    }
}

// --- 初期化とイベントリスナー ---
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
}


document.addEventListener('DOMContentLoaded', () => {
    // ★★★ 最初にUIモジュールの初期化を実行 ★★★
    ui.initializeUI();

    // --- DOM要素の取得 (DOMContentLoaded内で実行) ---
    const startGameButton = document.getElementById('start-game-button');
    const body = document.body;
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const confirmButton = document.getElementById('confirm-button');
    const deleteSlotButton = document.getElementById('delete-slot-button');
    const slotSelector = document.getElementById('slot-selector');
    const exportButton = document.getElementById('export-log-button');
    const importButton = document.getElementById('import-button');
    const importFileInput = document.getElementById('import-file-input');

    // ランディングページの処理
    if (startGameButton) {
        startGameButton.addEventListener('click', () => {
            body.classList.add('game-active');
            initializeGame();
        });
    }

    // ゲーム画面専用のイベントリスナー
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
        if (selectedValue === 'new_game') {
            ui.showScenarioSelection(startNewGame, state.getGameState().gameSlots.length > 0);
        } else if (selectedValue && state.getGameState().gameSlots.some(s => s.id == selectedValue)) {
            state.setActiveSlotId(selectedValue);
            loadGameFromSlot(selectedValue);
        } else {
            ui.showTemporaryMessage('プルダウンからロードするセーブデータ、または「新規ゲームを始める」を選択してください。');
        }
    });
    deleteSlotButton.addEventListener('click', deleteSelectedSlot);
    
    exportButton.addEventListener('click', () => {
        const activeSlotData = state.getActiveSlotData();
        ui.exportSaveData(activeSlotData);
    });

    importButton.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const fileContent = e.target.result;
            let importedSlot;
            
            try {
                if (file.name.endsWith('.json')) {
                    importedSlot = JSON.parse(fileContent);
                } else if (file.name.endsWith('.txt')) {
                    importedSlot = state.createSlotFromTxt(fileContent);
                } else {
                    throw new Error('サポートされていないファイル形式です。');
                }
            } catch (error) {
                alert(`ファイルの読み込みに失敗しました: ${error.message}`);
                return;
            }

            if (importedSlot && importedSlot.id && importedSlot.history) {
                if (state.importSlot(importedSlot)) {
                    ui.showTemporaryMessage(`データ「${importedSlot.name}」をインポートしました。`);
                    ui.updateSlotSelector({
                        gameSlots: state.getGameState().gameSlots,
                        maxSlots: state.MAX_SAVE_SLOTS
                    });
                }
            } else {
                alert('無効なセーブデータ形式です。');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    });
});

