const express = require("express");
const { createOctokit } = require("../Utils/Octokit");
const { createAST, extractMetadata } = require("../Utils/babelParser");
const MetaData = require("../Models/MetaData");
const Repository = require("../Models/Repository");
const FileContent = require("../Models/FileContent");
const getEmbeddingsVector = require("../Utils/Embed");
const treeToText = require("../Utils/TreeToText");
const upsertVectors = require("../Utils/PCupsert");
const vectorSearch = require("../Services/vectorSearch");
const buildAugmentationPrompt = require("../Services/buildAugumentationPrompt");
const getLLMAnswer = require("../Services/LLMModel");

const router = express.Router();

const IGNORED_PATHS = /(^|\/)(node_modules|\.git|dist|build|coverage)(\/|$)/;
const TREE_IGNORED_PATHS = /(^|\/)(node_modules|\.git|dist|build|coverage|\.next|\.vite|vendor)(\/|$)/i;
const TEXT_EXTENSIONS = /\.(js|jsx|ts|tsx|mjs|cjs|json|md|css|scss|html|yml|yaml|py|java|go|rs|rb|php|sql|sh)$/i;

async function persistFile({ owner, repo, repoDoc, file }) {
    const content = Buffer.from(file.content, "base64").toString("utf-8");
    const ast = createAST(content, file.path);
    const metadata = extractMetadata(ast, file.path, content);

    await MetaData.findOneAndUpdate(
        { repoId: repoDoc._id, filePath: file.path },
        {
            repoId: repoDoc._id,
            filePath: file.path,
            filesha: file.sha,
            imports: metadata.imports,
            functions: metadata.functions,
            classes: metadata.classes,
            exports: metadata.exports,
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    await FileContent.findOneAndUpdate(
        { repoId: repoDoc._id, filePath: file.path },
        { repoId: repoDoc._id, filePath: file.path, content, filesha: file.sha },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    return { path: file.path, sha: file.sha, content, metadata };
}

async function indexFiles(files, repoId, repoName) {
    const chunks = files
        .filter((file) => file.content.trim())
        .map((file) => ({
            id: `${repoId}-${file.path}-${file.sha}`,
            content: file.content.slice(0, 12000),
            metadata: {
                repoId: String(repoId),
                repoName,
                filePath: file.path,
                fileSha: file.sha,
                type: "code",
            },
        }));

    for (let offset = 0; offset < chunks.length; offset += 20) {
        const batch = chunks.slice(offset, offset + 20);
        const vectors = await getEmbeddingsVector(batch.map((chunk) => chunk.content));
        await upsertVectors(batch.map((chunk, index) => ({
                id: chunk.id,
                values: vectors[index],
                metadata: { ...chunk.metadata, text: chunk.content },
            })));
    }
    return chunks.length;
}

async function fetchPublicFile(owner, repo, branch, path, sha) {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${encodedPath}`
    );

    if (!response.ok) {
        throw new Error(`Unable to fetch public file: ${path} (${response.status})`);
    }

    const content = await response.text();
    return {
        path,
        sha,
        encoding: "base64",
        content: Buffer.from(content, "utf-8").toString("base64"),
    };
}

router.get("/repos", async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Please login with GitHub" });
        }
        const octokit = createOctokit(req.user.accessToken);
        const response = await octokit.rest.repos.listForAuthenticatedUser({ sort: "updated", per_page: 100 });
        res.status(200).json({ success: true, repositories: response.data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get("/contents/:owner/:repo", async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const octokit = createOctokit(req.user?.accessToken || null);
        const response = await octokit.rest.repos.getContent({ owner, repo, path: "" });
        res.status(200).json({ success: true, contents: response.data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/search/:owner/:repo", async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const userQuery = req.body.query;

        if (!userQuery || !userQuery.trim()) {
            return res.status(400).json({ success: false, message: "Query is required" });
        }

        const repoDoc = await Repository.findOne({ owner, repo }).select("_id").lean();

        if (!repoDoc) {
            return res.status(404).json({ success: false, message: "Repository is not indexed yet" });
        }

        const retrievedChunks = await vectorSearch(userQuery, repoDoc._id);

        if (retrievedChunks.length === 0) {
            return res.status(200).json({ 
                success: true, 
                answer: "No relevant code found for your query in the indexed codebase.",
                chunks: [],
                chunkCount: 0
            });
        }

        const prompt = buildAugmentationPrompt(userQuery, retrievedChunks);
        const answer = await getLLMAnswer(prompt);

        res.status(200).json({ 
            success: true, 
            answer: answer,
            chunks: retrievedChunks,
            chunkCount: retrievedChunks.length,
            query: userQuery
        });
    } catch (error) {
        console.error("Search error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/file-summary/:owner/:repo", async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const { path } = req.body;

        if (!path || typeof path !== "string") {
            return res.status(400).json({ success: false, message: "File path is required" });
        }

        const repoDoc = await Repository.findOne({ owner, repo }).select("_id").lean();
        if (!repoDoc) {
            return res.status(404).json({ success: false, message: "Repository is not indexed yet" });
        }

        let chunks = [];
        const savedFile = await FileContent.findOne({ repoId: repoDoc._id, filePath: path }).lean();
        if (savedFile?.content) {
            chunks = [{
                filePath: path,
                text: savedFile.content,
                metadata: { filePath: path, content: savedFile.content, functions: [] },
            }];
        } else {
            chunks = await vectorSearch(`Explain the purpose and flow of ${path}`, repoDoc._id, 5, path);
        }

        if (chunks.length === 0) {
            return res.status(200).json({
                success: true,
                summary: "This file is still being indexed. Please click the file again in a moment.",
            });
        }

        const prompt = `${buildAugmentationPrompt(
            `Analyze ${path} and produce a detailed but easy-to-understand developer summary. Explain the complete responsibility of the file and how its important parts work together, not just its first function. Cover the main routes, helper functions, data flow, external services, database operations, validation, and error handling that are visible in the code. Use only facts supported by the provided code context. Identify the file's actual imports, functions, classes, constants, routes, models, or services and explain why the important symbols are used. Do not invent symbols, dependencies, callers, or behavior. If a detail is not visible in the context, say that it is not visible rather than guessing. Keep the complete response between 250 and 400 words.

Return plain text only. Do not use Markdown headings, code fences, a Source section, or repeat the file name as a heading.
Use exactly this compact format:
Purpose: [3 to 4 clear sentences explaining what the complete file does, what problem it solves, and how its major responsibilities are divided]
Dependencies: [2 to 3 sentences naming the 3 to 6 most important imports or integrations and explaining the role of each]
Flow: [4 to 6 clear sentences explaining the main execution path from start to finish, including validation, authentication, data transformations, database changes, API calls, background work, and returned results]
Risk: [low, medium, or high] - [one short reason based on visible routes, callers, exports, or integrations]
When to touch this: [one practical maintenance scenario]
Suggested questions:
1. [short question referencing an actual symbol in the file]
2. [short question referencing an actual symbol in the file]
3. [short question referencing an actual symbol in the file]

Keep the answer between 160 and 300 words so it is complete but easy to scan. Every symbol must be visible in the file; do not guess.`,
            chunks
        )}`;
        const summary = await getLLMAnswer(prompt, {
            temperature: 0.2,
            maxOutputTokens: 1000,
        });

        return res.status(200).json({ success: true, summary });
    } catch (error) {
        console.error("File summary error:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/ingest/:owner/:repo", async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const accessToken = req.user?.accessToken || process.env.GITHUB_TOKEN;
        const octokit = createOctokit(accessToken);

        const repoResponse = await octokit.rest.repos.get({ owner, repo });
        const branch = repoResponse.data.default_branch;
        const branchResponse = await octokit.rest.repos.getBranch({ owner, repo, branch });
        const treeResponse = await octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha: branchResponse.data.commit.commit.tree.sha,
            recursive: "true",
        });
        const tree = treeResponse.data.tree.filter((item) => !TREE_IGNORED_PATHS.test(item.path));

        const repoDoc = await Repository.findOneAndUpdate(
            { owner, repo },
            {
                owner,
                repo,
                branch,
                lastCommitSha: branchResponse.data.commit.sha,
                visibility: repoResponse.data.private ? "private" : "public",
                githubId: String(repoResponse.data.id),
                lastAccessed: new Date(),
            },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );

        const candidates = tree
            .filter((item) => item.type === "blob" && TEXT_EXTENSIONS.test(item.path))
            .filter((item) => !IGNORED_PATHS.test(item.path))
            .slice(0, 100);

        res.status(200).json({
            success: true,
            repository: repoResponse.data,
            tree,
            files: [],
            indexed: 0,
            indexingStarted: true,
        });

        void (async () => {
            try {
                const files = [];
                for (const candidate of candidates) {
                    const file = accessToken
                        ? (await octokit.rest.repos.getContent({ owner, repo, path: candidate.path, ref: branch })).data
                        : await fetchPublicFile(owner, repo, branch, candidate.path, candidate.sha);
                    if (file.encoding !== "base64" || !file.content) continue;
                    files.push(await persistFile({ owner, repo, repoDoc, file }));
                }

                const repoName = `${owner}/${repo}`;
                await indexFiles(files, repoDoc._id, repoName);
                const treeText = treeToText(tree, `${owner}/${repo}`);
                const treeEmbeddings = await getEmbeddingsVector([treeText]);
                const treeVectorId = `${repoDoc._id}-tree-${branchResponse.data.commit.sha}`;
                await upsertVectors([{
                    id: treeVectorId,
                    values: treeEmbeddings[0],
                    metadata: {
                        repoId: String(repoDoc._id),
                        repoName,
                        filePaths: tree
                            .filter((item) => item.type === "blob")
                            .map((item) => item.path),
                        commitSha: branchResponse.data.commit.sha,
                        type: "tree",
                        text: treeText,
                    },
                }]);
                console.log(`Repository indexing complete: ${owner}/${repo}, files=${files.length}`);
            } catch (error) {
                console.error(`Repository indexing failed: ${owner}/${repo}`, error);
            }
        })();
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get("/file/:owner/:repo", async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const { path } = req.query;
        if (!path) {
            return res.status(400).json({ success: false, message: "File path is required" });
        }

        const accessToken = req.user?.accessToken || process.env.GITHUB_TOKEN;
        let response;

        if (accessToken) {
            const octokit = createOctokit(accessToken);
            response = await octokit.rest.repos.getContent({ owner, repo, path });
        } else {
            const encodedPath = path.split("/").map(encodeURIComponent).join("/");
            let branch = "main";
            let rawResponse = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`);

            if (!rawResponse.ok) {
                branch = "master";
                rawResponse = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`);
            }
            if (!rawResponse.ok) throw new Error(`Unable to fetch public file: ${path}`);

            const rawContent = await rawResponse.text();
            response = {
                data: {
                    name: path.split("/").pop(),
                    path,
                    size: Buffer.byteLength(rawContent),
                    sha: `raw-${branch}`,
                    branch,
                    private: false,
                    content: Buffer.from(rawContent, "utf-8").toString("base64"),
                },
            };
        }

        const content = Buffer.from(response.data.content, "base64").toString("utf-8");

        const repoDoc = await Repository.findOneAndUpdate(
            { owner, repo },
            {
                owner,
                repo,
                branch: response.data.branch || "main",
                lastCommitSha: response.data.sha || response.data.node_id || "",
                visibility: response.data.private ? "private" : "public",
                githubId: response.data?.id ? String(response.data.id) : undefined,
                lastAccessed: new Date(),
            },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );

        const ast = createAST(content, response.data.path);
        const metaData = extractMetadata(ast, response.data.path, content);

        const existing = await MetaData.findOne({ repoId: repoDoc._id, filePath: response.data.path });
        if (!existing) {
            await new MetaData({
                repoId: repoDoc._id,
                filePath: response.data.path,
                filesha: response.data.sha,
                imports: metaData.imports,
                functions: metaData.functions,
                classes: metaData.classes,
                exports: metaData.exports,
            }).save();
        } else if (existing.filesha !== response.data.sha) {
            await MetaData.findOneAndUpdate(
                { repoId: repoDoc._id, filePath: response.data.path },
                {
                    filesha: response.data.sha,
                    imports: metaData.imports,
                    functions: metaData.functions,
                    classes: metaData.classes,
                    exports: metaData.exports,
                }
            );
        }

        const existingFileContent = await FileContent.findOne({ repoId: repoDoc._id, filePath: response.data.path });
        if (!existingFileContent) {
            await new FileContent({
                repoId: repoDoc._id,
                filePath: response.data.path,
                content,
                filesha: response.data.sha,
            }).save();
        }

        res.status(200).json({
            success: true,
            file: {
                path: response.data.path,
                content,
                size: response.data.size,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
