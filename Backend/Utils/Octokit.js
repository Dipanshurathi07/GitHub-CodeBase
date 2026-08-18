import { Octokit } from "octokit";

export const createOctokit = (accessToken) => {
    const token = accessToken || process.env.GITHUB_TOKEN;

    if (token) {
        return new Octokit({
                        auth: token
        });
    }
    return new Octokit();
}