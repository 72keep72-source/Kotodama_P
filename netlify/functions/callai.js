// 安全な「受付」として機能するプログラム (callai.js)

exports.handler = async function(event) {
    // このプログラムが受け取った「会話の履歴」を取り出す
    const conversationHistory = JSON.parse(event.body);

    // 大事なAPIキーを、Netlifyの安全な場所からこっそり持ってくる
    const API_KEY = process.env.GOOGLE_API_KEY;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

    try {
        // GoogleのAIサーバーに、会話の履歴を送る
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(conversationHistory)
        });

        if (!response.ok) {
            // もしGoogleサーバーからエラーが返ってきたら、その内容を記録する
            const errorData = await response.json();
            throw new Error(errorData.error.message);
        }

        // うまくいったら、Googleサーバーからの返事を待つ
        const data = await response.json();

        // 受け取ったAIからの返事を、ゲーム画面に送り返す
        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };

    } catch (error) {
        // 何か問題が起きたら、エラー情報を返す
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};