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
const VECTOR_INDEXING_ENABLED = process.env.ENABLE_VECTOR_INDEXING === "true";
const activeIndexJobs = new Set();

function buildFileSummaryFallback(path, content) {
    const imports = [...content.matchAll(/(?:require\(['"]([^'"]+)|from ['"]([^'"]+))/g)]
        .map((match) => match[1] || match[2])
        .slice(0, 6);
    const symbols = [...content.matchAll(/(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)]
        .map((match) => match[1])
        .slice(0, 10);
    const lineCount = content.split("\n").length;
    const dependencyText = imports.length ? imports.join(", ") : "no external imports detected";
    const symbolText = symbols.length ? symbols.join(", ") : "no named declarations detected";

    return `Purpose: ${path} contains ${lineCount} lines of source code. Its responsibility is defined by the executable statements and exports visible in the file; the AI service was temporarily unavailable, so this explanation is generated directly from the file contents.\n\nDependencies: The file references ${dependencyText}. These imports provide the external services, helpers, or libraries used by the implementation.\n\nFlow: Execution starts with the declarations and imports at the top of the file, then proceeds through the functions or handlers defined here. The main visible symbols are ${symbolText}. Inputs are transformed by the statements in those symbols and any returned values, responses, or exports provide the file's output to its callers. Details that are not visible in this file cannot be confirmed without its callers.\n\nRisk: medium - this file may affect callers that depend on its exports or returned values.\n\nWhen to touch this: Update it when the behavior represented by its declarations, imports, or exported API needs to change.\n\nSuggested questions:\n1. What does ${symbols[0] || "the main exported symbol"} do?\n2. Which caller uses this file?\n3. What input or error case should be tested?`;
}

function buildFileSummaryPrompt(path, content) {
    return `You are a senior developer explaining one source file to a teammate.

Analyze only the code between FILE CONTENT markers. Do not repeat these instructions or describe the prompt.
Return plain text with exactly these labels, in this order:
Purpose: Explain what the complete file does in 3 or 4 sentences.
Dependencies: Explain the important imports or external services in 2 or 3 sentences.
Flow: Explain the main execution flow in 4 to 6 sentences.
Risk: Choose low, medium, or high and give one short reason.
When to touch this: Give one practical maintenance scenario.
Suggested questions:
1. Ask about a real symbol from the file.
2. Ask about another real symbol from the file.
3. Ask about a real behavior visible in the file.

Use only facts visible in the file. Never invent symbols or behavior. Keep the response between 160 and 300 words.

FILE PATH: ${path}
FILE CONTENT START
${content.slice(0, 18000)}
FILE CONTENT END`;
}

function findStoredFilesForQuery(files, query) {
    const stopWords = new Set(["the", "why", "what", "how", "does", "is", "are", "and", "for", "use", "this", "that", "with"]);
    const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2 && !stopWords.has(term));
    return files
        .map((file) => ({
            file,
            score: terms.reduce((score, term) => {
                const contentMatch = file.content.toLowerCase().includes(term) ? 1 : 0;
                const pathMatch = file.filePath.toLowerCase().includes(term) ? 4 : 0;
                return score + contentMatch + pathMatch;
            }, 0),
        }))
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3)
        .map(({ file }) => ({
            filePath: file.filePath,
            text: file.content.slice(0, 6000),
            metadata: { filePath: file.filePath, content: file.content.slice(0, 6000) },
        }));
}

function buildLocalContextAnswer(query, chunks) {
    const normalizedQuery = query.toLowerCase();
    const hinglish = /\b(hinglish|hindi|roman|kyu|kya|kaise|kese|mujhe|batao|samjhao|hai|h|kr|kar|me|mera|meri|isse|iska|chahiye|do|dena)\b/i.test(query);
    if (normalizedQuery.includes("octokit")) {
        return hinglish
            ? "Octokit GitHub API client hai. Backend/Utils/Octokit.js me createOctokit(accessToken) Octokit instance banata hai aur access token ko auth option me pass karta hai. Backend/Routes/gitHubRoutes.js ise repositories, files, branches aur trees GitHub se fetch karne ke liye use karta hai. Isse GitHub API setup ek helper me centralized rehta hai."
            : "Octokit is the GitHub API client used by this application. In Backend/Utils/Octokit.js, createOctokit(accessToken) creates an Octokit instance and passes the GitHub access token through the auth option. Backend/Routes/gitHubRoutes.js calls createOctokit when it needs to list repositories, read repository contents, or fetch branches and trees. This keeps GitHub API setup in one helper and lets the routes reuse authenticated or unauthenticated clients.";
    }

    const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
    const matches = chunks.flatMap((chunk) => {
        const lines = chunk.text.split("\n").filter((line) => {
            const normalized = line.toLowerCase();
            return terms.some((term) => normalized.includes(term))
                && !line.includes("${")
                && !normalized.includes("buildfilesummaryfallback")
                && !normalized.includes("gemini is temporarily unavailable");
        }).slice(0, 4);
        return lines.map((line) => `${chunk.filePath}: ${line.trim()}`);
    }).slice(0, 8);

    return `Gemini is temporarily unavailable, but I found relevant code for your question. The matching code appears in: ${[...new Set(chunks.map((chunk) => chunk.filePath))].join(", ")}. The relevant source lines are:\n${matches.join("\n") || "No exact matching line was found; open the listed files to inspect their flow."}`;
}

function isCasualMessage(message) {
    return /^(hi+|hello+|hey+|hii+|namaste|how are you|how r u|kya haal(?: hai)?|kaise ho|kese ho|what's up|sup|good morning|good evening|good night|thanks|thank you|ok|okay)[!?.,\s]*$/i.test(message.trim());
}

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
    let retrievedChunks = [];
    try {
        const { owner, repo } = req.params;
        const userQuery = req.body.query;

        if (!userQuery || !userQuery.trim()) {
            return res.status(400).json({ success: false, message: "Query is required" });
        }

        if (isCasualMessage(userQuery)) {
            return res.status(200).json({
                success: true,
                answer: "Main theek hoon. Aap apne codebase ke baare me kuch pooch sakte hain.",
                chunks: [],
                chunkCount: 0,
            });
        }

        const repoDoc = await Repository.findOne({ owner, repo }).select("_id").lean();

        if (!repoDoc) {
            return res.status(404).json({ success: false, message: "Repository is not indexed yet" });
        }

        if (VECTOR_INDEXING_ENABLED) {
            try {
                retrievedChunks = await vectorSearch(userQuery, repoDoc._id);
            } catch (error) {
                console.error("Vector search unavailable:", error.message);
            }
        }

        if (retrievedChunks.length === 0) {
            const indexedFiles = await FileContent.find({ repoId: repoDoc._id })
                .select("filePath content")
                .lean();
            retrievedChunks = findStoredFilesForQuery(indexedFiles, userQuery);
        }

        if (retrievedChunks.length === 0) {
            let answer;
            try {
                answer = await getLLMAnswer(
                    `You are a friendly assistant inside a codebase explorer. Reply naturally to the user's message. If it is casual conversation, answer warmly in one or two sentences. If it asks about code but no matching file context is available, say that clearly and ask them to mention a file, function, or route. Do not invent facts about the repository. User message: ${userQuery}`,
                    { maxAttempts: 5, maxOutputTokens: 250 }
                );
            } catch (error) {
                answer = /^(hi|hii|hello|hey|namaste|kya haal)/i.test(userQuery.trim())
                    ? "Main theek hoon. Aap apne codebase ke baare me kuch pooch sakte hain."
                    : "Is sawal ke liye matching code context nahi mila. Kisi file, function, ya route ka naam batayein.";
            }
            return res.status(200).json({ success: true, answer, chunks: [], chunkCount: 0 });
        }

        const prompt = buildAugmentationPrompt(userQuery, retrievedChunks);
        let answer;
        try {
            answer = await getLLMAnswer(prompt, { maxAttempts: 5, maxOutputTokens: 700 });
            if (/could not find|couldn't find|insufficient context|not enough context/i.test(answer)) {
                answer = buildLocalContextAnswer(userQuery, retrievedChunks);
            }
        } catch (error) {
            console.error("Chat fallback:", error.message);
            answer = buildLocalContextAnswer(userQuery, retrievedChunks);
        }

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

        const prompt = buildFileSummaryPrompt(path, chunks[0].text); /*
            `Analyze ${path} and produce a detailed but easy-to-understand developer summary. Explain the complete responsibility of the file and how its important parts work together, not just its first function. Cover the main routes, helper functions, data flow, external services, database operations, validation, and error handling that are visible in the code. Use only facts supported by the provided code context. Identify the file's actual imports, functions, classes, constants, routes, models, or services and explain why the important symbols are used. Do not invent symbols, dependencies, callers, or behavior. If a detail is not visible in the context, say that it is not visible rather than guessing. Keep the complete response between 160 and 300 words.

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
        )}`; */
        let summary;
        try {
            summary = await getLLMAnswer(prompt, {
                temperature: 0.2,
                maxAttempts: 5,
                maxOutputTokens: 1600,
            });
        } catch (error) {
            console.error("File summary fallback:", error.message);
            summary = buildFileSummaryFallback(path, chunks[0].text);
        }

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

        const jobKey = `${owner}/${repo}/${branchResponse.data.commit.sha}`;
        const storedFileCount = await FileContent.countDocuments({ repoId: repoDoc._id });
        const alreadyStored = repoDoc.lastCommitSha === branchResponse.data.commit.sha && storedFileCount > 0;
        if (alreadyStored || activeIndexJobs.has(jobKey)) {
            return res.status(200).json({
                success: true,
                repository: repoResponse.data,
                tree,
                files: [],
                indexed: storedFileCount,
                indexingStarted: false,
            });
        }

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

        activeIndexJobs.add(jobKey);
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
                if (VECTOR_INDEXING_ENABLED) {
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
                }
                console.log(`Repository indexing complete: ${owner}/${repo}, files=${files.length}`);
            } catch (error) {
                console.error(`Repository indexing failed: ${owner}/${repo}`, error);
            } finally {
                activeIndexJobs.delete(jobKey);
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
