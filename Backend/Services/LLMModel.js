const dotenv = require("dotenv");
dotenv.config();

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
let nextKeyIndex = 0;

function getGeminiKeys() {
  const numberedKeys = Array.from({ length: 5 }, (_, index) => process.env[`GEMINI_API_KEY${index + 1}`]);
  const keys = [...numberedKeys, process.env.GEMINI_API_KEY]
    .map((key) => key?.trim())
    .filter(Boolean);

  if (!keys.length) throw new Error("No Gemini API keys are configured");
  return [...new Set(keys)];
}

function getKeyOrder(keys) {
  const start = nextKeyIndex % keys.length;
  nextKeyIndex = (nextKeyIndex + 1) % keys.length;
  return keys.slice(start).concat(keys.slice(0, start));
}

async function getLLMAnswer(userPrompt, options = {}) {
  const keys = getGeminiKeys();
  const keyOrder = getKeyOrder(keys).slice(0, Math.min(options.maxAttempts ?? keys.length, keys.length));

  for (let attempt = 0; attempt < keyOrder.length; attempt += 1) {
    try {
      const response = await fetch(MODEL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": keyOrder[attempt],
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens ?? 1000,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (answer) return answer;
        throw new Error("No response from Gemini API");
      }

      const error = new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      const retryable = [429, 500, 502, 503, 504].includes(response.status);
      if (!retryable || attempt === keyOrder.length - 1) throw error;

      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = response.status === 429 && Number.isFinite(retryAfter)
        ? Math.min(retryAfter * 1000, 3000)
        : 500;
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error) {
      if (attempt === keyOrder.length - 1) {
        console.error("Error getting LLM answer:", error.message);
        throw error;
      }
    }
  }

  throw new Error("All Gemini API keys failed");
}

module.exports = getLLMAnswer;
