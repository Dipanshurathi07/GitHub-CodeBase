import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchRepoInfo = createAsyncThunk(
  'github/fetchRepoInfo',
  async (repoName, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/github/repos/${encodeURIComponent(repoName)}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return rejectWithValue(body.error || 'Failed to fetch repository info');
      }
      return response.json();
    } catch (error) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const githubSlice = createSlice({
  name: 'github',
  initialState: {
    repo: null,
    status: 'idle',
    error: null,
  },
  reducers: {
    clearRepo(state) {
      state.repo = null;
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchRepoInfo.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchRepoInfo.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.repo = action.payload;
      })
      .addCase(fetchRepoInfo.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Unable to fetch repository info';
      });
  },
});

export const { clearRepo } = githubSlice.actions;
export default githubSlice.reducer;
