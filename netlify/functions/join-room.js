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
      room_id,
      password,
      display_name
    } = requestData;

    if (!room_id || typeof room_id !== 'string') {
      throw new Error('room_id が不正です。');
    }

    const normalizedPassword =
      typeof password === 'string' ? password.trim() : '';

    const normalizedDisplayName =
      typeof display_name === 'string' && display_name.trim()
        ? display_name.trim()
        : 'プレイヤー';

    // ① 部屋取得
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', room_id)
      .single();

    if (roomError || !room) {
      throw new Error('指定された部屋が見つかりません。');
    }

    // ② 状態チェック
    if (room.status !== 'waiting') {
      throw new Error('この部屋は現在参加できません。');
    }

    // ③ パスワード確認
    const roomPassword = room.password_hash || '';
    if (roomPassword !== normalizedPassword) {
      throw new Error('パスワードが違います。');
    }

    // ④ 参加人数チェック
    const { count, error: countError } = await supabase
      .from('room_players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id);

    if (countError) {
      throw new Error(`参加人数の確認に失敗しました: ${countError.message}`);
    }

    if (count >= room.max_players) {
      throw new Error('この部屋は満員です。');
    }

    // ⑤ join順を決める
    const joinOrder = count;

    // ⑥ プレイヤー追加
    const { data: player, error: playerError } = await supabase
      .from('room_players')
      .insert([
        {
          room_id: room.id,
          display_name: normalizedDisplayName,
          is_ready: false,
          is_alive: true,
          turn_order: joinOrder,
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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        room,
        player
      })
    };
  } catch (error) {
    console.error('join-room error:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: error.message }
      })
    };
  }
};