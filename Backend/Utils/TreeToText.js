function treeToText(tree, repoName) {
    const lines = [`Repository: ${repoName}`, "Structure:"];

    for (const item of tree) {
        const kind = item.type === "tree" ? "directory" : "file";
        const size = item.size ? ` (${item.size} bytes)` : "";
        lines.push(`- ${kind}: ${item.path}${size}`);
    }

    return lines.join("\n");
}

module.exports = treeToText;
