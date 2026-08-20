const pineconeIndex = require("./PineCone");

async function upsertVectors(records) {
    if (!records.length) return;
    await pineconeIndex.upsert({ records });
}

module.exports = upsertVectors;
