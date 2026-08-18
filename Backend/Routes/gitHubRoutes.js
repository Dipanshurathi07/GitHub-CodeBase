const express = require("express");
const router = express.Router();
const { createOctokit } = require("../Utils/Octokit");
const { createAST, extractMetadata } = require("../Utils/babelParser");
const { MetaData } = require("../Models/MetaData");
const Repository = require("../Models/Repository");
const FileContent = require("../Models/FileContent");
const getEmbeddingsVector = require("../Utils/Embed");
const pineconeIndex = require("../Utils/PineCone");

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
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    await FileContent.findOneAndUpdate(
        { repoId: repoDoc._id, filePath: file.path },
        { repoId: repoDoc._id, filePath: file.path, content, filesha: file.sha },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    return { path: file.path, sha: file.sha, content, metadata };
}

async function indexFiles(files, repoId) {
    const chunks = files.filter((file) => file.content.trim()).map((file) => ({
        id: `${repoId}-${file.path}-${file.sha}`,
        content: file.content.slice(0, 12000),
        metadata: { repoId: String(repoId), filePath: file.path, fileSha: file.sha },
    }));

    for (let offset = 0; offset < chunks.length; offset += 20) {
        const batch = chunks.slice(offset, offset + 20);
        const vectors = await getEmbeddingsVector(batch.map((chunk) => chunk.content));
        await pineconeIndex.upsert(batch.map((chunk, index) => ({
            id: chunk.id,
            values: vectors[index],
            metadata: { ...chunk.metadata, text: chunk.content },
        })));
    }
    return chunks.length;
}

/**
 * GET /api/github/repos
 * Logged-in user ki repositories
 */
router.get("/repos", async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Please login with GitHub"
            });
        }
        const octokit = createOctokit(req.user.accessToken);

        const response = await octokit.rest.repos.listForAuthenticatedUser({
            sort: "updated",
            per_page: 100
        });

        res.status(200).json({
            success: true,
            repositories: response.data
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
});
/**
 * GET /api/github/repo/:owner/:repo
 * Repository details
 */
router.get("/repo/:owner/:repo", async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const accessToken = req.user?.accessToken || null;
        const octokit = createOctokit(accessToken);
        const response = await octokit.rest.repos.get({
            owner,
            repo
        });

        const repoDoc = await Repository.findOneAndUpdate(
            { owner, repo },
            {
                owner: response.data.owner.login,
                repo: response.data.name,
                branch: response.data.default_branch,
                lastCommitSha: response.data.pushed_at || response.data.node_id,
                visibility: response.data.private ? "private" : "public",
                githubId: response.data.id,
                lastAccessed: new Date(),
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        res.status(200).json({
            success: true,
            repository: response.data,
            persistedRepository: repoDoc,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
/**
 * GET /api/github/contents/:owner/:repo
 * Root folder contents
 */
router.get("/contents/:owner/:repo", async (req, res) => {

    try {
        const { owner, repo } = req.params;
        const accessToken = req.user?.accessToken || null;
        const octokit = createOctokit(accessToken);
        const response = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: ""
        });
        res.status(200).json({
            success: true,
            contents: response.data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
/**
 * GET /api/github/tree/:owner/:repo
 * Complete repository tree
 */
router.get("/tree/:owner/:repo", async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const accessToken = req.user?.accessToken || process.env.GITHUB_TOKEN;
        const octokit = createOctokit(accessToken);
        // Get default branch
        const repoResponse = await octokit.rest.repos.get({
            owner,
            repo
        });
        const branch = repoResponse.data.default_branch;
        // Get latest commit SHA
        const branchResponse = await octokit.rest.repos.getBranch({
            owner,
            repo,
            branch
        });
        const treeSha = branchResponse.data.commit.commit.tree.sha;
        // Get complete tree
        const treeResponse = await octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha: treeSha,
            recursive: "true"
        });
        const tree = treeResponse.data.tree.filter((item) => !TREE_IGNORED_PATHS.test(item.path));
        res.status(200).json({
            success: true,
            tree
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/github/ingest/:owner/:repo
 * Fetch, persist, embed, and index the repository's text files.
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
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        const candidates = tree
            .filter((item) => item.type === "blob" && TEXT_EXTENSIONS.test(item.path))
            .filter((item) => !IGNORED_PATHS.test(item.path))
            .slice(0, 100);
        const files = [];
        for (const candidate of candidates) {
            const response = await octokit.rest.repos.getContent({ owner, repo, path: candidate.path, ref: branch });
            if (response.data.encoding !== "base64" || !response.data.content) continue;
            files.push(await persistFile({ owner, repo, repoDoc, file: response.data }));
        }

        const indexed = await indexFiles(files, repoDoc._id);
        res.status(200).json({
            success: true,
            repository: repoResponse.data,
            tree,
            files,
            indexed,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/github/file/:owner/:repo
 *
 * Query Param:
 * ?path=src/index.js
 */
router.get("/file/:owner/:repo", async (req, res) => {
    try {
        const { owner, repo } = req.params;
        const { path } = req.query;
        if (!path) {
            return res.status(400).json({
                success: false,
                message: "File path is required"
            });
        }
        const accessToken = req.user?.accessToken || process.env.GITHUB_TOKEN;
        let response;

        if (accessToken) {
            const octokit = createOctokit(accessToken);
            response = await octokit.rest.repos.getContent({ owner, repo, path });
        } else {
            const encodedPath = path.split('/').map(encodeURIComponent).join('/');
            let branch = 'main';
            let rawResponse = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`);

            if (!rawResponse.ok) {
                branch = 'master';
                rawResponse = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`);
            }

            if (!rawResponse.ok) {
                throw new Error(`Unable to fetch public file: ${path}`);
            }

            const rawContent = await rawResponse.text();
            response = {
                data: {
                    name: path.split('/').pop(),
                    path,
                    size: Buffer.byteLength(rawContent),
                    sha: `raw-${branch}`,
                    branch,
                    private: false,
                    content: Buffer.from(rawContent, 'utf-8').toString('base64'),
                },
            };
        }
        const content = Buffer.from(
            response.data.content,
            "base64"
        ).toString("utf-8");

        // Ensure repository is persisted and available for metadata linking
        const repoDoc = await Repository.findOneAndUpdate(
            { owner, repo },
            {
                owner,
                repo,
                branch: response.data.branch || response.data?.git_url?.split("/").slice(-2, -1)[0] || "main",
                lastCommitSha: response.data.sha || response.data.node_id || "",
                visibility: response.data.private ? "private" : "public",
                githubId: response.data?.id || null,
                lastAccessed: new Date(),
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        const ast = createAST(content, response.data.path);
        const metaData = extractMetadata(ast, response.data.path,content);

        const existing = await MetaData.findOne({  //file exist
            repoId: repoDoc._id,
            filePath: response.data.path
        });
        if(!existing) {
            const metaDataDoc = new MetaData({
                repoId: repoDoc._id,
                filePath: response.data.path,
                filesha: response.data.sha,
                imports: metaData.imports,
                functions: metaData.functions,
                classes: metaData.classes,
                exports: metaData.exports,
            });
            await metaDataDoc.save();
        }else if(existing.filesha !== response.data.sha) { //file updated
            const data = await MetaData.findOneAndUpdate(
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

        // Save or update FileContent
        const existingFileContent = await FileContent.findOne({
            repoId: repoDoc._id,
            filePath: response.data.path
        });
        if(!existingFileContent) {
            const fileContentDoc = new FileContent({
                repoId: repoDoc._id,
                filePath: response.data.path,
                content: content,
                filesha: response.data.sha
            });
            await fileContentDoc.save();
        }else if(existingFileContent.filesha !== response.data.sha) { //file updated
            await FileContent.findOneAndUpdate(
                { repoId: repoDoc._id, filePath: response.data.path },
                {
                    content: content,
                    filesha: response.data.sha
                }
            );
        }

        res.status(200).json({
            success: true,
            file: {
                name: response.data.name,
                path: response.data.path,
                size: response.data.size,
                sha: response.data.sha,
                content
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;