const dotenv = require("dotenv");
dotenv.config();

async function getLLMAnswer(userPrompt, options = {}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in .env file");
  }

  const maxAttempts = options.maxAttempts ?? 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: options.temperature ?? 0.7,
              maxOutputTokens: options.maxOutputTokens ?? 1000,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (answer) return answer;
        throw new Error("No response from Gemini API");
      }

      const error = new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error("Error getting LLM answer:", error.message);
        throw error;
      }
    }
  }

  throw new Error("Gemini request failed");
}

module.exports = getLLMAnswer;
