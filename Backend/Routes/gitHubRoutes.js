const express = require("express");
const router = express.Router();
const { createOctokit } = require("../Utils/Octokit");
const { createAST, extractMetadata } = require("../Utils/babelParser");
const { MetaData } = require("../Models/MetaData");
const Repository = require("../Models/Repository");
const FileContent = require("../Models/FileContent");
const getEmbeddingsVector = require("../Utils/Embed");
const treeToText = require("../Utils/TreeToText");
const upsertVectors = require("../Utils/PCupsert");
const vectorSearch = require("../Services/vectorSearch");

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

/**
 * GET /api/github/repos
 */
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

/**
 * GET /api/github/contents/:owner/:repo
 */
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

/**
 * POST /api/github/search/:owner/:repo
 * Body: { query }
 */
router.post("/search/:owner/:repo", async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const repoDoc = await Repository.findOne({ owner, repo }).select("_id").lean();

        if (!repoDoc) {
            return res.status(404).json({ success: false, message: "Repository is not indexed yet" });
        }

        const results = await vectorSearch(req.body.query, repoDoc._id);
        res.status(200).json({ success: true, results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/github/ingest/:owner/:repo
 * Bulk: saari text files fetch + persist + embed + tree bhi embed
 */
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
                githubId: repoResponse.data.id,
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

/**
 * GET /api/github/file/:owner/:repo?path=src/index.js
 * Single file: fetch + persist for on-demand file loading
 */
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
                githubId: response.data?.id || null,
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
        const isNewOrUpdated = !existingFileContent || existingFileContent.filesha !== response.data.sha;

        if (!existingFileContent) {
            await new FileContent({
                repoId: repoDoc._id,
                filePath: response.data.path,
                content,
                filesha: response.data.sha,
            }).save();
        } else if (existingFileContent.filesha !== response.data.sha) {
            await FileContent.findOneAndUpdate(
                { repoId: repoDoc._id, filePath: response.data.path },
                { content, filesha: response.data.sha }
            );
        }

        if (isNewOrUpdated) {
            const embeddings = await getEmbeddingsVector([content.slice(0, 12000)]);
            await upsertVectors([{
                id: `${repoDoc._id}-${response.data.path}-${response.data.sha}`,
                values: embeddings[0],
                metadata: {
                    repoId: String(repoDoc._id),
                    filePath: response.data.path,
                    fileSha: response.data.sha,
                    type: "code",
                    text: content.slice(0, 12000),
                },
            }]);
        }

        res.status(200).json({
            success: true,
            file: {
                name: response.data.name,
                path: response.data.path,
                size: response.data.size,
                sha: response.data.sha,
                content,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;