import index from "../Utils/PineCone";
export async function vectorSearch(queryVector, topK, repoId) {
  try{
    const response = await index.query({
      queryRequest: {
        vector: queryVector,
        topK: topK,
        filter: {
          repoId: repoId,
        }
      }
    });
     console.log(response);
     return response;
  //   const threshold = 0.8; // Define your threshold value here
  //   response.matches = response.matches.filter(match => match.score >= threshold);
  //   return response.matches;
  // } 
  //   return response.matches;
  } catch (error) {
    console.error("Error occurred while performing vector search:", error);
    throw error;
  }
}