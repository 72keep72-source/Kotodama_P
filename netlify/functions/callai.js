const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MAX_RECENT_TURNS = 14; // 直近何件まで履歴を送るか

function buildTrimmedHistory(conversationHistory) {
  if (!Array.isArray(conversationHistory) || conversationHistory.length === 0) {
    return [];
  }

  // 先頭はルールブック注入の想定
  const firstTurn = conversationHistory[0];

  // 最後は今回送るユーザー入力なので除外
  const bodyTurns = conversationHistory.slice(1, -1);

  // 直近だけ残す
  const recentTurns = bodyTurns.slice(-MAX_RECENT_TURNS);

  // ルールブック + 直近履歴
  return [firstTurn, ...recentTurns];
}

function getSafeErrorMessage(error) {
  const raw = String(error?.message || "");

  if (raw.includes("429") || raw.includes("Too Many Requests")) {
    return "アクセスが集中しています。少し時間をおいて再度お試しください。";
  }

  if (raw.includes("spending cap")) {
    return "ただいま通信上限に達しています。時間をおいて再度お試しください。";
  }

  if (raw.includes("503") || raw.includes("overloaded")) {
    return "AIサーバーが混み合っています。しばらく待ってからお試しください。";
  }

  return "通信中にエラーが発生しました。時間をおいて再度お試しください。";
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: { message: "Method Not Allowed" } }),
    };
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

    const lastTurn = conversationHistory[conversationHistory.length - 1];
    if (!lastTurn || !lastTurn.parts || !lastTurn.parts[0] || !lastTurn.parts[0].text) {
      throw new Error("会話履歴の最後のデータ形式が不正です。");
    }

    const trimmedHistory = buildTrimmedHistory(conversationHistory);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const chat = model.startChat({
      history: trimmedHistory,
    });

    const lastMessage = lastTurn.parts[0].text;
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    const text = response.text();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text }],
            },
          },
        ],
      }),
    };
  } catch (error) {
    console.error("callai error:", error);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: { message: getSafeErrorMessage(error) },
      }),
    };
  }
};
