const mongoose = require('mongoose');

const importSchema = new mongoose.Schema({
  source: String,
  type: { type: String },
  startLine: Number,
  endLine: Number,
}, { _id: false });

const functionSchema = new mongoose.Schema({
  name: String,
  async: Boolean,
  startLine: Number,
  endLine: Number,
}, { _id: false });

const classSchema = new mongoose.Schema({
  name: String,
  methods: [String],
  startLine: Number,
  endLine: Number,
}, { _id: false });

const exportSchema = new mongoose.Schema({
  name: String,
  type: { type: String },
  startLine: Number,
  endLine: Number,
}, { _id: false });

const metaDataSchema = new mongoose.Schema({
  repoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  filesha: {
    type: String,
  },
  imports: [importSchema],
  functions: [functionSchema],
  classes: [classSchema],
  exports: [exportSchema],
}, { timestamps: true });

const MetaData = mongoose.model('MetaData', metaDataSchema);

module.exports = MetaData;
