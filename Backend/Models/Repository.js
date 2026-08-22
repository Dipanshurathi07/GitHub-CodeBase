const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema({
  owner: {
    type: String,
    required: true,
  },
  repo: {
    type: String,
    required: true,
  },
  branch: {
    type: String,
    default: 'main',
  },
  lastCommitSha: {
    type: String,
  },
  visibility: {
    type: String,
    default: 'public',
  },
  githubId: {
    type: String,
  },
  lastAccessed: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

const Repository = mongoose.model('Repository', repositorySchema);

module.exports = Repository;
