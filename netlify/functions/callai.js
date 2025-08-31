// Google AI SDKをインポート
const { GoogleGenerativeAI } = require("@google/generative-ai");

// APIキーを環境変数から取得
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Netlify関数の本体
exports.handler = async (event) => {
  // POSTリクエスト以外のアクセスを拒否
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: { message: "Method Not Allowed" } }) };
  }

  try {
    // リクエストのbodyが存在するかチェック
    if (!event.body) {
      throw new Error("リクエストのデータが空です。");
    }

    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      throw new Error("リクエストされたJSONの形式が正しくありません。");
    }
    
    // ... 既存のチェックの後 ...

    const conversationHistory = requestData.history;

    // ... if (!conversationHistory ... ) のチェック ...

    // ▼▼▼【修正案】ここから追加 ▼▼▼
    const lastTurn = conversationHistory[conversationHistory.length - 1];
    // 履歴の最後のデータ構造が正しいかチェックする
    if (!lastTurn || !lastTurn.parts || !lastTurn.parts[0]) {
        throw new Error("会話履歴の最後のデータ形式が不正です。");
    }
    // ▲▲▲【修正案】ここまで追加 ▲▲▲

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});
    const chat = model.startChat({
      history: conversationHistory.slice(0, -1),
    });

    const lastMessage = lastTurn.parts[0].text; // lastTurnを使うように変更
    const result = await chat.sendMessage(lastMessage);
// ... 以降続く ...
    const response = await result.response;
    const text = response.text();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: text }]
          }
        }]
      })
    };

  } catch (error) {
    console.error("エラーが発生しました:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: { message: error.message }
      })
    };
  }
};

