import { configureStore } from '@reduxjs/toolkit';
import authReducer from './ReduxSlice/authSlice';
import githubReducer from './ReduxSlice/githubSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    github: githubReducer,
  },
});

export default store;
