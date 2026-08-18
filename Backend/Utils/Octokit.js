import { Octokit } from "octokit";

export const createOctokit = (accessToken) => {
  if (accessToken) {
        return new Octokit({
            auth: accessToken
        });
    }
    return new Octokit();
}