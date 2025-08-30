const API_URL = '/.netlify/functions/callai';

/**
 * AIにAPIコールを行う
 * @param {Array} history - AIに送信する会話履歴
 * @returns {Promise<string>} AIからの応答テキスト
 */
export async function callAI(history) {
    const requestData = { history };

    const response = await fetch(API_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(requestData) 
    });

    if (!response.ok) {
        let errorMsg = `サーバーエラー (ステータス: ${response.status})。`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error?.message || errorMsg;
        } catch (e) {
            // JSON解析に失敗した場合
        }
        throw new Error(errorMsg);
    }

    const data = await response.json();
    const fullAiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!fullAiText) {
        throw new Error("AIから有効な応答がありませんでした。");
    }

    return fullAiText;
}
