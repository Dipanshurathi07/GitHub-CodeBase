const mongoose = require("mongoose");
const mongooseSchema = mongoose.Schema;

const fileContentSchema = new mongooseSchema({
  repoId : {
    type : mongoose.Schema.Types.ObjectId,
    ref : "Repository",
    required : true
  },
  filePath : {
    type : String,
    required : true,
  },
  content : {
    type : String,
    required : true,
  },
  filesha : {
    type : String,
  }
});
module.exports = mongoose.model("FileContent", fileContentSchema);