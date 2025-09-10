// 各モジュールから必要な機能をインポート
import * as state from './services/state.js';
import * as ui from './ui.js';
import { callAI } from './services/api.js';
// ★★★ 2つのルールブックの読み込み方を統一 ★★★
import { RULEBOOK_1ST } from './assets/data/rulebook_1st.js';
import { RULEBOOK_SF_AI } from './assets/data/rulebook_SF_AI.js';
import { RULEBOOK_TEST } from './assets/data/rulebook_Otameshi.js';

// --- 初期化処理 ---
// ページのHTMLが全て読み込まれた後に、一度だけ実行される
document.addEventListener('DOMContentLoaded', () => {
    ui.initializeUI();
    
    // --- DOM要素の取得 ---
    const body = document.body;
    const landingPage = document.getElementById('landing-page');
    const startGameButton = document.getElementById('start-game-button');
    const gameWrapper = document.getElementById('game-wrapper');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const confirmButton = document.getElementById('confirm-button');
    const deleteSlotButton = document.getElementById('delete-slot-button');
    const slotSelector = document.getElementById('slot-selector');
    const exportButton = document.getElementById('export-log-button');
    const importButton = document.getElementById('import-button');
    const importFileInput = document.getElementById('import-file-input');

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
            const fullAiText = await callAI(currentHistory);
            state.addHistory({ role: 'model', parts: [{ text: fullAiText }] });
            const parsedData = state.parseAIResponse(fullAiText);

            ui.updateThinkingMessage(parsedData.storyLogText);
            ui.displayActions(parsedData.actions, handleUserCommand);
           
        // ★ テストシナリオ完了ボタンの表示処理
            if (parsedData.showAdButton) {
                ui.showNextScenarioButton(() => {
                    ui.showAdModal(state.getGameState().activeScenarioType);
                });
            } else {
                ui.displayActions(parsedData.actions, handleUserCommand);
            }
            
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

        // テストシナリオでは行動回数を消費しない
        if (state.getGameState().activeScenarioType !== 'testS') {
            if (!state.hasActionsLeft()) {
                ui.showAdModal(state.getGameState().activeScenarioType);
                return;
            }
            state.decrementActions();
            ui.updateActionCountDisplay(state.getGameState().dailyActions);
        }


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
        // ▼▼▼ ここからが修正箇所です ▼▼▼
            let rulebook;
            if (scenarioType === 'sf') {
                rulebook = RULEBOOK_SF_AI;
        } else if (scenarioType === 'testS') { // ★テストシナリオ用の分岐を追加
                rulebook = RULEBOOK_TEST;
        } else { // デフォルトはファンタジー
            rulebook = RULEBOOK_1ST;
        }
        // ▲▲▲ ここまでが修正箇所です ▲▲▲
    
        
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
            initializeGame();
            return;
        }
        
        ui.clearGameScreen();
        ui.updateAllDisplays(gameState);
        ui.rebuildLog(gameState.conversationHistory);
        
        // ★★★ ここからが修正点 ★★★
        const lastTurn = gameState.conversationHistory[gameState.conversationHistory.length - 1];

        if (lastTurn && lastTurn.role === 'model') {
            // 最後にAIが応答した場合：その時の選択肢を再表示して、プレイヤーの入力を待つ
            const parsedData = state.parseAIResponse(lastTurn.parts[0].text);
            ui.displayActions(parsedData.actions, handleUserCommand);
            ui.toggleInput(false); 
        } else if (lastTurn && lastTurn.role === 'user') {
            // プレイヤーが入力した直後だった場合：AIに応答を生成させる
            processAIturn();
        } else {
            // それ以外（ゲーム開始直後など）
            ui.toggleInput(false);
        }
        // ★★★ ここまでが修正点 ★★★
    }

    /** 選択されたスロットを削除 */
    function deleteSelectedSlot() {
        const selectedId = slotSelector.value;
        if (!selectedId || selectedId === 'new_game' || !state.getGameState().gameSlots.some(s => s.id == selectedId)) {
            ui.showTemporaryMessage('削除するセーブデータを選択してください。');
            return;
        }
        const slotToDelete = state.getGameState().gameSlots.find(s => s.id == selectedId);
        if (confirm(`本当にセーブデータ「${slotToDelete.name}」を削除しますか？`)) {
            state.deleteSlot(selectedId);
            initializeGame(); // ★ window.location.reload() から変更
        }
    }

    /** ゲーム画面の初期化 */
    function initializeGame() {
        ui.initializeUI();
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

    // --- イベントリスナーの設定 ---
    if (startGameButton) {
        startGameButton.addEventListener('click', () => {
            // ★★★ hiddenクラスを剥がす処理を追加 ★★★
            landingPage.classList.add('hidden');
            gameWrapper.classList.remove('hidden');
            body.classList.add('game-active');
            initializeGame();
        });
    }

    sendButton.addEventListener('click', () => handleUserCommand());
    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.ctrlKey) {
            event.preventDefault();
            handleUserCommand();
        }
    });
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = `${userInput.scrollHeight}px`;
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

    importButton.addEventListener('click', () => importFileInput.click());

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
                    importedSlot = state.createSlotFromTxt(fileContent, RULEBOOK_1ST);
                } else {
                    throw new Error('サポートされていないファイル形式です。(.json または .txt)');
                }
            } catch (error) {
                ui.showTemporaryMessage(`ファイルの読み込みに失敗しました: ${error.message}`);
                return;
            }

            if (importedSlot && importedSlot.id && importedSlot.history) {
                const importResult = state.importSlot(importedSlot);
                if (importResult.success) {
                    initializeGame();
                    ui.highlightSlot(importResult.importedSlot.id);
                    loadGameFromSlot(importResult.importedSlot.id);
                } else if (importResult.reason === 'slot_full') {
                    ui.showTemporaryMessage('セーブスロットがいっぱいです。既存のデータを削除してください。');
                }
            } else {
                ui.showTemporaryMessage('無効なセーブデータ形式です。');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    });
});

