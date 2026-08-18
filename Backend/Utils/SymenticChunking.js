const DocumentBuilder = require("./DocumentBuilder");
const { encode, decode } = require("gpt-tokenizer");
const getEmbeddingsVector = require("./Embed.js");
const index = require("../Utils/PineCone.js");

const TOKEN_LIMIT = 2000;

const extractChunk = (code, startLine, endLine) => {
    const lines = code.split("\n");
    return lines.slice(startLine - 1, endLine).join("\n");
};

const splitIntoChunks = (code, metadata) => {
    const tokenIds = encode(code);
    const chunks = [];

    for (let i = 0; i < tokenIds.length; i += TOKEN_LIMIT) {
        const part = tokenIds.slice(i, i + TOKEN_LIMIT);
        const partNum = Math.floor(i / TOKEN_LIMIT) + 1;

        chunks.push({
            id: `${metadata.repoId}-${metadata.filePath}-${metadata.name}-part${partNum}`,
            content: decode(part),
            metadata: { ...metadata, part: partNum, tokenCount: part.length },
        });
    }

    return chunks;
};

const buildMetadata = (document, item, type) => ({
    repoId: document.metadata.repoId,
    filePath: document.metadata.filePath,
    fileSha: document.metadata.fileSha,
    type,
    name: item.name,
    startLine: item.startLine,
    endLine: item.endLine,
});

const processItems = (items, document, type) => {
    const chunks = [];

    for (const item of items) {
        const code = extractChunk(document.pageContent, item.startLine, item.endLine);
        const tokenCount = encode(code).length;
        const metadata = buildMetadata(document, item, type);

        if (tokenCount <= TOKEN_LIMIT) {
            chunks.push({
                id: `${document.metadata.repoId}-${document.metadata.filePath}-${item.name}`,
                content: code,
                metadata: { ...metadata, tokenCount },
            });
        } else {
            chunks.push(...splitIntoChunks(code, metadata));
        }
    }

    return chunks;
};

const storeInPinecone = async (chunks) => {
    for (let i = 0; i < chunks.length; i += 20) {
        const batch = chunks.slice(i, i + 20);
        const texts = batch.map((doc) => doc.content);
        const vectors = await getEmbeddingsVector(texts);

        const pineconeVectors = batch.map((doc, idx) => ({
            id: doc.id,
            values: vectors[idx],
            metadata: { ...doc.metadata, text: doc.content },
        }));

        await index.upsert(pineconeVectors);
        console.log(`✅ Stored batch: ${i + batch.length}/${chunks.length}`);
    }
};

const SemanticChunking = async (filePath, fileSha, repoId) => {
    const document = await DocumentBuilder(filePath, fileSha, repoId);

    const functionChunks = processItems(document.metadata.functions || [], document, "function");
    const classChunks = processItems(document.metadata.classes || [], document, "class");
    const chunks = [...functionChunks, ...classChunks];

    await storeInPinecone(chunks);

    return chunks;
};

module.exports = SemanticChunking;