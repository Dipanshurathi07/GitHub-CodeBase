const mongoose = require("mongoose");

const metaDataSchema = new mongoose.Schema(
  {
    repoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Repository",
      required: true,
    },
    filePath: {
      type: String,
      required: true,
      trim: true,
    },
    filesha : {
      type : String,
      required : true,
    },
    imports: [
      {
        source: { type: String, required: true, trim: true },
        type: { type: String, required: true, trim: true },
        startLine: { type: Number },
        endLine: { type: Number },
      },
    ],
    functions: [
      {
        name: { type: String, trim: true },
        async: { type: Boolean, default: false },
        startLine: { type: Number },
        endLine: { type: Number },
      },
    ],
    classes: [
      {
        name: { type: String, trim: true },
        methods: [{ type: String, trim: true }],
        startLine: { type: Number },
        endLine: { type: Number },
      },
    ],
    exports: [
      {
        name: { type: String, required: true, trim: true },
        type: { type: String, required: true, trim: true },
        startLine: { type: Number },
        endLine: { type: Number },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const MetaData = mongoose.model("MetaData", metaDataSchema);
module.exports = { MetaData };