import { createRoom } from './services/supabase.js';

export async function handleCreateRoom({
    scenarioType,
    maxPlayers,
    password
}) {
    const result = await createRoom({
        scenario_type: scenarioType,
        max_players: maxPlayers,
        password
    });

    return result;
}

import { createRoom, joinRoom } from './services/supabase.js';

export async function handleCreateRoom({
    scenarioType,
    maxPlayers,
    password
}) {
    const result = await createRoom({
        scenario_type: scenarioType,
        max_players: maxPlayers,
        password
    });

    return result;
}

export async function handleJoinRoom({
    roomId,
    password,
    displayName
}) {
    const result = await joinRoom({
        room_id: roomId,
        password,
        display_name: displayName
    });

    return result;
}

import { createRoom, joinRoom, updateReadyState } from './services/supabase.js';

export async function handleCreateRoom({
    scenarioType,
    maxPlayers,
    password
}) {
    const result = await createRoom({
        scenario_type: scenarioType,
        max_players: maxPlayers,
        password
    });

    return result;
}

export async function handleJoinRoom({
    roomId,
    password,
    displayName
}) {
    const result = await joinRoom({
        room_id: roomId,
        password,
        display_name: displayName
    });

    return result;
}

export async function handleUpdateReady({
    playerId,
    isReady
}) {
    const result = await updateReadyState({
        player_id: playerId,
        is_ready: isReady
    });

    return result;
}