import { createRoom, joinRoom, updateReadyState } from './services/supabase.js';

// 部屋作成
export async function handleCreateRoom({
    scenarioType,
    maxPlayers,
    password
}) {
    return await createRoom({
        scenario_type: scenarioType,
        max_players: maxPlayers,
        password
    });
}

// 参加
export async function handleJoinRoom({
    roomId,
    password,
    displayName
}) {
    return await joinRoom({
        room_id: roomId,
        password,
        display_name: displayName
    });
}

// Ready
export async function handleUpdateReady({
    playerId,
    isReady
}) {
    return await updateReadyState({
        player_id: playerId,
        is_ready: isReady
    });
}