import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiUrl } from '../../lib/api.js';

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(apiUrl('/auth/user'), {
        credentials: 'include',
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return rejectWithValue(body.error || 'Failed to fetch current user');
      }

      const data = await response.json();
      return data.user;
    } catch (error) {
      return rejectWithValue(error.message || 'Network error');
    }
  }
);

export const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    status: 'idle',
    error: null,
  },
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
      state.error = null;
    },
    clearUser(state) {
      state.user = null;
      state.error = null;
      state.status = 'idle';
    },
    setAuthError(state, action) {
      state.error = action.payload;
      state.status = 'failed';
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Unable to fetch user';
      });
  },
});

export const { setUser, clearUser, setAuthError } = authSlice.actions;
export default authSlice.reducer;
