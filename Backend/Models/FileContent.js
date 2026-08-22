const mongoose = require('mongoose');

const fileContentSchema = new mongoose.Schema({
  repoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  content: {
    type: String,
  },
  filesha: {
    type: String,
  },
}, { timestamps: true });

const FileContent = mongoose.model('FileContent', fileContentSchema);

module.exports = FileContent;
