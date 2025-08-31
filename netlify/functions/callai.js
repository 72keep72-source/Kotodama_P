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
    
    const conversationHistory = requestData.history;

    // ★ 修正: 会話履歴が空、または配列でない場合にエラーを投げる
    if (!conversationHistory || !Array.isArray(conversationHistory) || conversationHistory.length === 0) {
        throw new Error("クライアントから送信された会話履歴が空、または不正です。");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest"});
    const chat = model.startChat({
      history: conversationHistory.slice(0, -1),
    });

    const lastMessage = conversationHistory[conversationHistory.length - 1].parts[0].text;
    const result = await chat.sendMessage(lastMessage);
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

