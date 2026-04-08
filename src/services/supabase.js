const SEND_PRIVATE_NOTE_API_URL = '/.netlify/functions/send-private-note';

/**
 * 秘密メモを送信する
 * @param {Object} payload
 * @param {string} payload.room_id
 * @param {string} payload.from_player_id
 * @param {string} payload.to_player_id
 * @param {string} payload.content
 * @returns {Promise<Object>}
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
const CREATE_ROOM_API_URL = '/.netlify/functions/create-room';

/**
 * 部屋を作成する
 * @param {Object} payload
 * @param {string} payload.scenario_type
 * @param {number} payload.max_players
 * @param {string} payload.password
 * @returns {Promise<{success: boolean, room: Object, player: Object}>}
 */
export async function createRoom(payload) {
    const response = await fetch(CREATE_ROOM_API_URL, {
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

    if (!data.success || !data.room || !data.player) {
        throw new Error('部屋作成結果が不正です。');
    }

    return data;
}

const JOIN_ROOM_API_URL = '/.netlify/functions/join-room';

/**
 * 部屋に参加する
 * @param {Object} payload
 * @param {string} payload.room_id
 * @param {string} payload.password
 * @param {string} payload.display_name
 * @returns {Promise<{success: boolean, room: Object, player: Object}>}
 */
export async function joinRoom(payload) {
    const response = await fetch(JOIN_ROOM_API_URL, {
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

    if (!data.success || !data.room || !data.player) {
        throw new Error('部屋参加結果が不正です。');
    }

    return data;
}

const UPDATE_READY_API_URL = '/.netlify/functions/update-ready';

/**
 * Ready状態を更新する
 * @param {Object} payload
 * @param {string} payload.player_id
 * @param {boolean} payload.is_ready
 * @returns {Promise<{success: boolean, player: Object, room: Object, players: Array, all_ready: boolean}>}
 */
export async function updateReadyState(payload) {
    const response = await fetch(UPDATE_READY_API_URL, {
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

    if (!data.success || !data.player || !data.room) {
        throw new Error('Ready更新結果が不正です。');
    }

    return data;
}