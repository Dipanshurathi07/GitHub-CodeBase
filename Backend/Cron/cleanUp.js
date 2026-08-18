const cron = require('node-cron');
const Repository = require("../Models/Repository");
const { MetaData } = require("../Models/MetaData");
const FileContent = require("../Models/FileContent");

cron.schedule('0 1 1 * *', async () => {
  try {
    const thirtyDaysAgoDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const repos = await Repository.find({ lastAccessed: { $lt: thirtyDaysAgoDate } });
    if (repos.length > 0) {
      for (const repo of repos) {
        await MetaData.deleteMany({ repoId: repo._id });
        await Repository.deleteOne({ _id: repo._id });
        await FileContent.deleteMany({ repoId: repo._id });
      }
    }
  } catch (error) {
    console.error("Error occurred while cleaning up repositories:", error);
  }
});

module.exports = cron;