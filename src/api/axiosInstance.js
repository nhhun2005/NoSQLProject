import nProgress from 'nprogress';
import baseAxios from '../utils/baseAxios';
import { API_BASE_URL } from '../utils/apiConfig';
import { createAuthClient } from './createAuthClient';
import { store } from '../redux/store';
import { FETCH_USER_LOGIN_FAIL } from '../redux/action/userAction';
nProgress.configure({
  showSpinner: false,
  trickleSpeed: 100
});
const api = createAuthClient({
  baseURL: API_BASE_URL,
  storage: localStorage,
  refreshClient: baseAxios,
  progress: nProgress,
  onSessionExpired: () => store.dispatch({
    type: FETCH_USER_LOGIN_FAIL
  })
});
export default api;
