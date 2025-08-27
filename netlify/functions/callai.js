// Google AI SDKをインポート
const { GoogleGenerativeAI } = require("@google/generative-ai");

// APIキーを環境変数から取得
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Netlify関数の本体
exports.handler = async (event) => {
  // ★改善点1: POSTリクエスト以外のアクセスを拒否
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // ★改善点2: リクエストのbodyが存在するかチェック
    if (!event.body) {
      throw new Error("リクエストのデータが空です。");
    }

    // ★改善点3: JSONの解析自体もtry...catchで囲み、より安全に
    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      throw new Error("リクエストされたJSONの形式が正しくありません。");
    }
    
    // フロントエンドから送られてきた会話履歴を取得
    const conversationHistory = requestData.history;

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
        throw new Error("会話履歴(history)が不正です。");
    }

    // Google AIモデルを取得してチャットセッションを開始
    const model = genAI.getGenerativeModel({ model: "gemini-pro"});
    const chat = model.startChat({
      history: conversationHistory.slice(0, -1), // 最後のユーザー入力を除く
    });

    // 最後のユーザー入力を取得してメッセージを送信
    const lastMessage = conversationHistory[conversationHistory.length - 1].parts[0].text;
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    const text = response.text();

    // 成功した場合は、AIの応答を返す
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
    // ★改善点4: 発生したエラーを詳細に返す
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