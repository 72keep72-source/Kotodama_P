const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: 'Method Not Allowed' } })
    };
  }

  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabaseの環境変数が不足しています。');
    }

    if (!event.body) {
      throw new Error('リクエストボディが空です。');
    }

    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      throw new Error('JSONの形式が正しくありません。');
    }

    const {
      room_id,
      from_player_id,
      to_player_id,
      content
    } = requestData;

    if (!room_id || !from_player_id || !to_player_id || !content) {
      throw new Error('必要な項目が不足しています。');
    }

    const trimmedContent = String(content).trim();

    if (!trimmedContent) {
      throw new Error('メモ内容が空です。');
    }

    if (trimmedContent.length > 1000) {
      throw new Error('メモは1000文字以内にしてください。');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data, error } = await supabase
      .from('player_private_notes')
      .insert([
        {
          room_id,
          from_player_id,
          to_player_id,
          content: trimmedContent
        }
      ])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        note: data
      })
    };
  } catch (error) {
    console.error('send-private-note error:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: {
          message: error.message || '秘密メモの送信に失敗しました。'
        }
      })
    };
  }
};