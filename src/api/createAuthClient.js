import axios from 'axios';

// Dependency injection lets regression tests cover refresh without a server or DB.
export function createAuthClient({
  baseURL,
  storage,
  refreshClient,
  onSessionExpired,
  progress
}) {
  const api = axios.create({
    baseURL,
    timeout: 15000
  });
  let refreshFlight = null;
  let pending = 0;
  const finish = () => {
    pending = Math.max(0, pending - 1);
    if (!pending) progress?.done();
  };
  const expire = () => {
    storage.removeItem('accessToken');
    storage.removeItem('refreshToken');
    onSessionExpired?.();
  };
  api.interceptors.request.use(config => {
    if (pending++ === 0) progress?.start();
    const token = storage.getItem('accessToken');
    config.headers.Authorization = token ? `Bearer ${token}` : undefined;
    return config;
  });
  api.interceptors.response.use(response => {
    finish();
    return response;
  }, async error => {
    finish();
    const request = error.config;
    if (error.response?.status !== 401 || !request) throw error;
    if (request._retry) {
      expire();
      throw error;
    }
    request._retry = true;
    const refreshToken = storage.getItem('refreshToken');
    if (!refreshToken) {
      expire();
      throw error;
    }
    if (!refreshFlight) {
      refreshFlight = (async () => {
        try {
          const response = await refreshClient.post('/auth/refresh', {
            refreshToken
          });
          if (storage.getItem('refreshToken') !== refreshToken) throw new Error('Phiên đăng nhập đã thay đổi.');
          if (typeof response.data?.accessToken !== 'string' || !response.data.accessToken) {
            expire();
            throw new Error('Không thể khôi phục phiên đăng nhập.');
          }
          storage.setItem('accessToken', response.data.accessToken);
          return response.data.accessToken;
        } catch (failure) {
          if ([401, 403].includes(failure.response?.status) && storage.getItem('refreshToken') === refreshToken) expire();
          throw failure;
        } finally {
          refreshFlight = null;
        }
      })();
    }
    const token = await refreshFlight;
    request.headers.Authorization = `Bearer ${token}`;
    return api(request);
  });
  return api;
}
