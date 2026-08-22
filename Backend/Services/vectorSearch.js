const MetaData = require("../Models/MetaData");
const getEmbeddingsVector = require("../Utils/Embed");
const pineconeIndex = require("../Utils/PineCone");

const MIN_SCORE = 0.7;

async function vectorSearch(query, repoId, topK = 5, filePath = null) {
    if (!query?.trim()) {
        throw new Error("Search query is required");
    }

    const [queryVector] = await getEmbeddingsVector([query.trim()]);
    const response = await pineconeIndex.query({
        vector: queryVector,
        topK,
        includeMetadata: true,
        filter: {
            repoId: String(repoId),
            ...(filePath ? { filePath } : {}),
        },
    });

    const matches = (response.matches || []).filter((match) => match.score >= MIN_SCORE);
    const paths = [...new Set(matches.map((match) => match.metadata?.filePath).filter(Boolean))];
    const metadata = await MetaData.find({ repoId, filePath: { $in: paths } }).lean();
    const metadataByPath = new Map(metadata.map((item) => [item.filePath, item]));

    return matches.map((match) => ({
        id: match.id,
        score: match.score,
        type: match.metadata?.type || "code",
        repoName: match.metadata?.repoName || null,
        filePath: match.metadata?.filePath || null,
        filePaths: match.metadata?.filePaths || [],
        text: match.metadata?.text || "",
        metadata: metadataByPath.get(match.metadata?.filePath) || null,
    }));
}

module.exports = vectorSearch;
