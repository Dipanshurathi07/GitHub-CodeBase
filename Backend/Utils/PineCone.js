const { Pinecone } = require('@pinecone-database/pinecone');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.Index('explain-codebase');

module.exports = index;