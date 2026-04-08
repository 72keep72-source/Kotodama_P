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
      scenario_type,
      max_players,
      password
    } = requestData;

    if (!scenario_type || typeof scenario_type !== 'string') {
      throw new Error('scenario_type が不正です。');
    }

    const normalizedMaxPlayers = Number(max_players);
    if (
      !Number.isInteger(normalizedMaxPlayers) ||
      normalizedMaxPlayers < 2 ||
      normalizedMaxPlayers > 4
    ) {
      throw new Error('max_players は2〜4の整数で指定してください。');
    }

    const normalizedPassword =
      typeof password === 'string' ? password.trim() : '';

    // ① 部屋を作成
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert([
        {
          status: 'waiting',
          max_players: normalizedMaxPlayers,
          current_turn_index: 0,
          scenario_type,
          password_hash: normalizedPassword || null,
          host_player_id: null
        }
      ])
      .select()
      .single();

    if (roomError) {
      throw new Error(`rooms作成失敗: ${roomError.message}`);
    }

    // ② ホストプレイヤーを作成
    const { data: player, error: playerError } = await supabase
      .from('room_players')
      .insert([
        {
          room_id: room.id,
          display_name: 'プレイヤー1',
          is_ready: false,
          is_alive: true,
          turn_order: 0,
          dex: 10,
          hp_current: 100,
          hp_max: 100
        }
      ])
      .select()
      .single();

    if (playerError) {
      throw new Error(`room_players作成失敗: ${playerError.message}`);
    }

    // ③ rooms に host_player_id を反映
    const { data: updatedRoom, error: updateError } = await supabase
      .from('rooms')
      .update({
        host_player_id: player.id
      })
      .eq('id', room.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`host_player_id更新失敗: ${updateError.message}`);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        room: updatedRoom,
        player
      })
    };
  } catch (error) {
    console.error('create-room error:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: error.message }
      })
    };
  }
};