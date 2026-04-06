const SEND_PRIVATE_NOTE_API_URL = '/.netlify/functions/send-private-note';

/**
 * 秘密メモを送信する
 * @param {Object} payload
 * @param {string} payload.room_id
 * @param {string} payload.from_player_id
 * @param {string} payload.to_player_id
 * @param {string} payload.content
 * @returns {Promise<Object>} 保存されたメモデータ
 */
export async function sendPrivateNote(payload) {
    const response = await fetch(SEND_PRIVATE_NOTE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        let errorMsg = `サーバーエラー (ステータス: ${response.status})。`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error?.message || errorMsg;
        } catch (e) {
            // JSON解析失敗時はデフォルト文言
        }
        throw new Error(errorMsg);
    }

    const data = await response.json();

    if (!data.success || !data.note) {
        throw new Error('秘密メモの保存結果が不正です。');
    }

    return data.note;
}