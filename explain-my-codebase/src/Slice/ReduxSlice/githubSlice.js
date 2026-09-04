import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiUrl } from '../../lib/api.js';

async function request(url, options) {
  const response = await fetch(apiUrl(url), { credentials: 'include', ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || 'GitHub request failed');
  return body;
}

export const fetchRepositories = createAsyncThunk(
  'github/fetchRepositories',
  async (_, { rejectWithValue }) => {
    try {
      const data = await request('/api/github/repos');
      return data.repositories;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchFile = createAsyncThunk(
  'github/fetchFile',
  async ({ owner, repo, path }, { rejectWithValue }) => {
    try {
      const data = await request(`/api/github/file/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}?path=${encodeURIComponent(path)}`);
      return data.file;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchFileSummary = createAsyncThunk(
  'github/fetchFileSummary',
  async ({ owner, repo, path }, { rejectWithValue }) => {
    try {
      const data = await request(`/api/github/file-summary/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      return { path, summary: data.summary };
    } catch (error) {
      return rejectWithValue({ path, message: error.message });
    }
  }
);

export const fetchCodebaseAnswer = createAsyncThunk(
  'github/fetchCodebaseAnswer',
  async ({ owner, repo, query }, { rejectWithValue }) => {
    try {
      const data = await request(`/api/github/search/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      return data.answer;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const ingestRepository = createAsyncThunk(
  'github/ingestRepository',
  async ({ owner, repo }, { rejectWithValue }) => {
    try {
      return await request(`/api/github/ingest/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { method: 'POST' });
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const githubSlice = createSlice({
  name: 'github',
  initialState: {
    repo: null,
    repositories: [],
    tree: [],
    filesByPath: {},
    ingestStatus: 'idle',
    indexedCount: 0,
    status: 'idle',
    error: null,
    summariesByPath: {},
    summaryLoadingPath: null,
  },
  reducers: {
    clearRepo(state) {
      state.repo = null;
      state.tree = [];
      state.filesByPath = {};
      state.ingestStatus = 'idle';
      state.summariesByPath = {};
      state.summaryLoadingPath = null;
      state.indexedCount = 0;
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchRepositories.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchRepositories.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.repositories = action.payload;
      })
      .addCase(fetchRepositories.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchFile.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchFile.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.filesByPath[action.payload.path] = action.payload;
      })
      .addCase(fetchFile.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(fetchFileSummary.pending, (state, action) => {
        state.summaryLoadingPath = action.meta.arg.path;
      })
      .addCase(fetchFileSummary.fulfilled, (state, action) => {
        state.summaryLoadingPath = null;
        state.summariesByPath[action.payload.path] = action.payload.summary;
      })
      .addCase(fetchFileSummary.rejected, (state, action) => {
        state.summaryLoadingPath = null;
        state.error = action.payload?.message || 'Unable to generate file summary';
      })
      .addCase(fetchCodebaseAnswer.rejected, (state, action) => {
        state.error = action.payload || 'Unable to answer this question';
      })
      .addCase(ingestRepository.pending, (state) => {
        state.ingestStatus = 'loading';
        state.error = null;
      })
      .addCase(ingestRepository.fulfilled, (state, action) => {
        state.ingestStatus = 'succeeded';
        state.repo = action.payload.repository;
        state.tree = action.payload.tree || [];
        state.indexedCount = action.payload.indexed;
        state.filesByPath = Object.fromEntries(action.payload.files.map((file) => [file.path, file]));
      })
      .addCase(ingestRepository.rejected, (state, action) => {
        state.ingestStatus = 'failed';
        state.error = action.payload || 'Unable to index repository';
      });
  },
});

export const { clearRepo } = githubSlice.actions;
export default githubSlice.reducer;
