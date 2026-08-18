const FileContent = require("../Models/FileContent");
const MetaData = require("../Models/MetaData");

const DocumentBuilder = async (filePath, fileSha,repoId) => {
    try {
        const metaData = await MetaData.findOne({
            filePath,
            fileSha,
            repoId
        });

        if (!metaData) {
            throw new Error("Metadata not found.");
        }

        const fileContent = await FileContent.findOne({
            filePath,
            fileSha,
            repoId
        });

        if (!fileContent) {
            throw new Error("File content not found.");
        }

        return {
            pageContent: fileContent.content,
            startLine: fileContent.startLine || 0,
            endLine: fileContent.endLine || 0,
            metadata: {
                imports: metaData.imports || [],
                exports: metaData.exports || [],
                functions: metaData.functions || [],
                classes: metaData.classes || [],
                filePath,
                fileSha,
                repoId
            },
        };
    } catch (err) {
        console.error(err);
        throw err;
    }
};

module.exports = DocumentBuilder;