async function getEmbeddingsVector(texts) {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: texts,
      model: 'voyage-4-large',
      output_dimension: 1024,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to get embeddings: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data.map((item) => [
    ...item.embedding,
    ...new Array(1536 - item.embedding.length).fill(0),
  ]);
}

module.exports = getEmbeddingsVector;
