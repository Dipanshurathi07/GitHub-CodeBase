const mongoose = require("mongoose");
const mongooseSchema = mongoose.Schema;

const repoSchema = new mongooseSchema({
  owner : {
    type : String,
    required : true
  },
  repo : {
    type : String,
    required : true
  },
  branch : {
    type : String,
    required : true
  },
  lastCommitSha : {
    type : String,
    required : true
  },
  visibility : {
    type : String,
    enum : ["public","private"],
    required : true
  },
  githubId : {
    type : Number,
    required : true
  },
  lastAccessed : {
    type : Date,
    required : true,
    default : Date.now,
  }
},{timestamps: true});
const Repository = mongoose.model("Repository", repoSchema);
module.exports = Repository;