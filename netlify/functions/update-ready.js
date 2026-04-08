const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabaseの環境変数が不足しています。');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: 'Method Not Allowed' }
      })
    };
  }

  try {
    if (!event.body) {
      throw new Error('リクエストのデータが空です。');
    }

    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      throw new Error('リクエストされたJSONの形式が正しくありません。');
    }

    const {
      player_id,
      is_ready
    } = requestData;

    if (!player_id || typeof player_id !== 'string') {
      throw new Error('player_id が不正です。');
    }

    if (typeof is_ready !== 'boolean') {
      throw new Error('is_ready は true / false で指定してください。');
    }

    // ① player更新
    const { data: player, error: playerError } = await supabase
      .from('room_players')
      .update({ is_ready })
      .eq('id', player_id)
      .select()
      .single();

    if (playerError || !player) {
      throw new Error(`プレイヤー更新失敗: ${playerError?.message || 'player not found'}`);
    }

    // ② 部屋の参加者一覧取得
    const { data: players, error: playersError } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', player.room_id);

    if (playersError || !players) {
      throw new Error(`参加者一覧取得失敗: ${playersError?.message || 'players not found'}`);
    }

    // ③ rooms取得
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', player.room_id)
      .single();

    if (roomError || !room) {
      throw new Error(`部屋取得失敗: ${roomError?.message || 'room not found'}`);
    }

    const joinedCount = players.length;
    const allReady =
      joinedCount === room.max_players &&
      players.every((p) => p.is_ready === true);

    let updatedRoom = room;

    // ④ 全員readyなら playing に更新
    if (allReady && room.status === 'waiting') {
      const { data: newRoom, error: updateRoomError } = await supabase
        .from('rooms')
        .update({
          status: 'playing',
          current_turn_index: 0
        })
        .eq('id', room.id)
        .select()
        .single();

      if (updateRoomError || !newRoom) {
        throw new Error(`部屋状態更新失敗: ${updateRoomError?.message || 'room update failed'}`);
      }

      updatedRoom = newRoom;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        player,
        room: updatedRoom,
        players,
        all_ready: allReady
      })
    };
  } catch (error) {
    console.error('update-ready error:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: error.message }
      })
    };
  }
};