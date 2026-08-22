/**
 user query - String
  retrievedChunks - Array of objects, each containing:
    - metadata: {
        - filePath: String
        - functions: Array of Strings
        - content: String
      }
        return string - formatted prompt for the LLM
 */
function buildAugmentationPrompt(userQuery, retrievedChunks) {
  let context = "";

  for (let index = 0; index < retrievedChunks.length; index += 1) {
    const chunk = retrievedChunks[index];
    const metadata = chunk.metadata || {};
    const filePath = metadata.filePath || chunk.filePath || "unknown file";
    const functions = metadata.functions || [];
    const content = metadata.content || chunk.text || "";

    context += `Source #${index + 1}: ${filePath}\n`;
    if (functions.length > 0) {
      const functionNames = functions.map((item) => item.name || item).join(", ");
      context += `Functions: ${functionNames}\n`;
    }
    context += `\`\`\`\n${content}\n\`\`\`\n\n`;
  }

  const prompt = `You are a senior developer explaining a codebase to a teammate.

Rules:
- Answer only using the context below.
- Mention the specific file name(s) in your answer.
- If the context is insufficient, say "I couldn't find this in the indexed codebase".
- Be concise and technical.

Context from codebase:
${context}

User question: ${userQuery}`;

  return prompt;
}

// Export the function so other files can use it
module.exports = buildAugmentationPrompt;
