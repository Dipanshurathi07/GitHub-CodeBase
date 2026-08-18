# Explain My Codebase — Frontend

React + Vite + Tailwind frontend for the AI GitHub onboarding tool. Ships with
the MVP feature set as mock/demo data so the UI is fully clickable before any
backend exists:

- Repo URL input (landing page)
- File structure view (collapsible tree)
- File explain panel (summary, key points, "used by" links)
- Chat with codebase (canned responses, easy to swap for a real API)

## Run it

```bash
npm install
npm run dev
```

Open the printed local URL (usually http://localhost:5173).

## Project structure

```
src/
  components/
    Header.jsx            top bar, repo name, reset
    Hero.jsx               landing page: headline, repo input, feature strip
    DiffTerminal.jsx       signature animated "diff" visual on the hero
    Workspace.jsx           post-submit 3-pane layout (tree / explain / chat)
    FileTree.jsx            collapsible file tree
    FileExplainPanel.jsx    summary + key points + dependents for a file
    ChatPanel.jsx           chat UI with suggested questions
  data/
    mockData.js              demo file tree, explanations, chat replies — swap for real API calls
  App.jsx                    view switching (landing <-> workspace)
  index.css                  Tailwind entry + a few base styles
tailwind.config.js            design tokens (colors, fonts, animations)
```

## Wiring up the real thing

Everything fake lives in `src/data/mockData.js`. To connect a backend:

1. **Repo submit** — in `App.jsx`, `handleRepoSubmit` currently just parses
   the URL. Call your backend here to kick off indexing, then pass the
   returned file tree into `Workspace`.
2. **File tree** — `Workspace.jsx` uses `mockFileTree`. Replace with the tree
   your backend returns for the submitted repo.
3. **File explanations** — `FileExplainPanel.jsx` reads from
   `mockExplanations` keyed by file name. Swap for a fetch keyed by file path
   when a file is selected (consider caching per-repo).
4. **Chat** — `ChatPanel.jsx`'s `send()` fakes a delay then calls
   `mockChatReply()`. Replace with a real request (streaming works well here
   — the bubble is already set up to take arbitrary text).

## Design notes

Dark, terminal/IDE-inspired palette (`ink` = background family, `add` =
green "explained" accent, `signal` = interactive blue, `del` = amber used
sparingly). Headings and UI chrome use IBM Plex Mono to keep the "reading
code" feeling; body copy uses Inter for readability. The hero's signature
element renders the product's core action — turning code into plain-English
explanation — as an animated git diff, since that's the visual vocabulary
this tool's audience already reads daily.
