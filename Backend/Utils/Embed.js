async function getEmbeddingsVector(texts) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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

    if (response.ok) {
      const data = await response.json();
      return data.data.map((item) => [
        ...item.embedding,
        ...new Array(1536 - item.embedding.length).fill(0),
      ]);
    }

    if (response.status !== 429 || attempt === maxAttempts) {
      if (response.status === 429) {
        throw new Error('Voyage AI embedding quota/rate limit exhausted. Check VOYAGE_API_KEY usage or wait for the quota to reset.');
      }
      throw new Error(`Failed to get embeddings: ${response.status} ${response.statusText}`);
    }

    const retryAfter = Number(response.headers.get('retry-after'));
    const delayMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : attempt * 2000;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

module.exports = getEmbeddingsVector;
