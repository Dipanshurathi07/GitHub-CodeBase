export async function getEmbeddingsVector([text]){
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: [text],
      model: 'voyage-4-large',
    }),
  });
if(!response.ok){
  throw new Error(`Failed to get embeddings: ${response.statusText}`);
}

}