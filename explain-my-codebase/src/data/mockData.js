// Mock data standing in for real GitHub API + AI responses.
// Swap these for real calls to your backend / LLM once it's wired up.

export const mockFileTree = {
  name: 'react-query',
  type: 'folder',
  children: [
    {
      name: 'src',
      type: 'folder',
      children: [
        {
          name: 'core',
          type: 'folder',
          children: [
            { name: 'query.ts', type: 'file', lang: 'ts', lines: 412 },
            { name: 'queryCache.ts', type: 'file', lang: 'ts', lines: 188 },
            { name: 'queryClient.ts', type: 'file', lang: 'ts', lines: 264 },
            { name: 'mutation.ts', type: 'file', lang: 'ts', lines: 176 },
          ],
        },
        {
          name: 'react',
          type: 'folder',
          children: [
            { name: 'useQuery.ts', type: 'file', lang: 'ts', lines: 96 },
            { name: 'useMutation.ts', type: 'file', lang: 'ts', lines: 84 },
            { name: 'QueryClientProvider.tsx', type: 'file', lang: 'tsx', lines: 52 },
          ],
        },
        { name: 'index.ts', type: 'file', lang: 'ts', lines: 21 },
      ],
    },
    {
      name: 'tests',
      type: 'folder',
      children: [
        { name: 'query.test.ts', type: 'file', lang: 'ts', lines: 340 },
        { name: 'useQuery.test.tsx', type: 'file', lang: 'tsx', lines: 290 },
      ],
    },
    { name: 'package.json', type: 'file', lang: 'json', lines: 64 },
    { name: 'tsconfig.json', type: 'file', lang: 'json', lines: 22 },
    { name: 'README.md', type: 'file', lang: 'md', lines: 148 },
  ],
}

export const mockExplanations = {
  'query.ts': {
    summary:
      "The engine room. Defines the Query class that tracks a single query's state — data, status, error, timestamps — and decides when it's stale, when to refetch, and who to notify when it changes.",
    keyPoints: [
      'Query class wraps one cache entry and its lifecycle (fresh → stale → inactive → garbage-collected).',
      'fetch() de-dupes in-flight requests so 10 components calling the same query only trigger 1 network call.',
      'Observers subscribe here — this is how React components get re-rendered when data changes.',
    ],
    dependents: ['queryCache.ts', 'useQuery.ts', 'queryClient.ts'],
    risk: 'high',
  },
  'queryCache.ts': {
    summary:
      'An in-memory store keyed by a hash of the query key. Think of it as the single source of truth every Query instance is registered in.',
    keyPoints: [
      'build() creates or returns an existing Query for a given key — this is the de-dupe entry point.',
      'Emits cache events (added / removed / updated) that devtools and subscribers listen to.',
    ],
    dependents: ['queryClient.ts', 'useQuery.ts'],
    risk: 'medium',
  },
  'queryClient.ts': {
    summary:
      "The public API surface. Most app code touches this, not Query or QueryCache directly — it's the façade that wires cache, default options, and the query/mutation caches together.",
    keyPoints: [
      'fetchQuery(), invalidateQueries(), setQueryData() all live here.',
      'Holds the default options every query inherits unless overridden.',
    ],
    dependents: ['QueryClientProvider.tsx', 'useQuery.ts', 'useMutation.ts'],
    risk: 'medium',
  },
  'mutation.ts': {
    summary:
      'Same idea as Query but for writes. Tracks a mutation through idle → loading → success/error, without caching results long-term the way queries are.',
    keyPoints: [
      'No de-dupe — every mutate() call is intentional, unlike queries.',
      'onMutate / onSettled hooks here are what power optimistic updates.',
    ],
    dependents: ['useMutation.ts'],
    risk: 'low',
  },
  'useQuery.ts': {
    summary:
      "The hook almost every consumer imports. Bridges React's render cycle to a Query instance: subscribes on mount, re-renders on change, unsubscribes on unmount.",
    keyPoints: [
      'Wraps queryClient.getQueryCache().build() — this is where your queryKey actually becomes a cache entry.',
      "Returns the stable { data, isLoading, error, refetch } shape you're used to.",
    ],
    dependents: [],
    risk: 'high',
  },
  'useMutation.ts': {
    summary:
      'React-facing wrapper around the Mutation class. Gives you mutate(), mutateAsync(), and the loading/error state to drive a submit button.',
    keyPoints: [
      'Cleans up in-flight mutations on unmount to avoid setting state on an unmounted component.',
    ],
    dependents: [],
    risk: 'low',
  },
  'QueryClientProvider.tsx': {
    summary:
      "The context provider you wrap your app in. Without this at the root, every useQuery/useMutation call below it has nothing to talk to.",
    keyPoints: ['Just a thin React Context.Provider — no logic worth worrying about.'],
    dependents: [],
    risk: 'low',
  },
  'index.ts': {
    summary: 'Public export barrel. This is the map of what the package actually promises to consumers — if it is not exported here, treat it as private.',
    keyPoints: [],
    dependents: [],
    risk: 'low',
  },
  'package.json': {
    summary: 'Standard manifest. Worth noting: peerDependencies pins the React version range this build was tested against.',
    keyPoints: [],
    dependents: [],
    risk: 'low',
  },
  'tsconfig.json': {
    summary: 'Strict mode is on. If your PR fails to build, check here before assuming the compiler is wrong.',
    keyPoints: [],
    dependents: [],
    risk: 'low',
  },
  'README.md': {
    summary: 'Installation + a 10-line quickstart. Deeper docs live outside the repo, linked near the top.',
    keyPoints: [],
    dependents: [],
    risk: 'low',
  },
  'query.test.ts': {
    summary: 'The most exhaustive test file in the repo — read this before query.ts if you want to understand edge cases by example.',
    keyPoints: [],
    dependents: [],
    risk: 'low',
  },
  'useQuery.test.tsx': {
    summary: 'Integration-style tests using @testing-library/react. Good reference for how the hook is meant to be consumed.',
    keyPoints: [],
    dependents: [],
    risk: 'low',
  },
}

export const mockChatSeed = [
  {
    role: 'assistant',
    content:
      "I've indexed react-query — 14 files, ~2,150 lines. Ask me anything: \"where does caching happen\", \"how does a mutation retry\", or point me at a specific file.",
  },
]

export const mockChatReply = (question) => {
  const q = question.toLowerCase()
  if (q.includes('cach')) {
    return "Caching lives in queryCache.ts. Every query key gets hashed into a single QueryCache entry, so query.ts never talks to the network directly — it always goes through the cache's build() method first, which either returns an existing in-flight Query or creates one. That's also your de-dupe layer for free."
  }
  if (q.includes('mutat')) {
    return "Mutations flow through mutation.ts (the state machine: idle → loading → success/error) and are exposed to React via useMutation.ts. Retries are configurable per-mutation through the retry option, handled inside the same executeMutation loop that runs the mutationFn."
  }
  if (q.includes('start') || q.includes('entry') || q.includes('begin')) {
    return "Start at src/index.ts to see the public surface, then jump to src/react/useQuery.ts — that's the hook 90% of consumers touch, and it'll pull you into queryClient.ts and query.ts naturally from there."
  }
  return "Good question — based on the file graph, that logic most likely sits in core/query.ts or queryClient.ts. Open the file explain panel on either one and I can go deeper on the specific function you're after."
}
