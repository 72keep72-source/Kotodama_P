const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: { message: "Method Not Allowed" } }) };
  }

  try {
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

    if (!conversationHistory || !Array.isArray(conversationHistory) || conversationHistory.length === 0) {
        throw new Error("クライアントから送信された会話履歴が空、または不正です。");
    }

    // ▼▼▼【この部分が重要です】▼▼▼
    // 履歴の最後のデータ構造が正しいかチェックします
    const lastTurn = conversationHistory[conversationHistory.length - 1];
    if (!lastTurn || !lastTurn.parts || !lastTurn.parts[0]) {
        throw new Error("会話履歴の最後のデータ形式が不正です。");
    }
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    // callai.jsの修正案
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-latest" });
    const chat = model.startChat({
      history: conversationHistory.slice(0, -1),
    });

    const lastMessage = lastTurn.parts[0].text; // lastTurnを使うように変更
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