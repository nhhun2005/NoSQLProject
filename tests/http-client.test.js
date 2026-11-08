import test from 'node:test';
import assert from 'node:assert/strict';
import axios, { AxiosError } from 'axios';
import { createAuthClient } from '../src/api/createAuthClient.js';
import { normalizeApiBaseUrl, API_BASE_URL, resolveAssetUrl } from '../src/utils/apiConfig.js';
function harness(refresh = async () => ({
  data: {
    accessToken: 'fresh-token'
  }
})) {
  const tokens = new Map([['accessToken', 'old-token'], ['refreshToken', 'refresh-token']]);
  let expired = 0,
    refreshes = 0,
    starts = 0,
    dones = 0;
  const storage = {
    getItem: k => tokens.get(k) ?? null,
    setItem: (k, v) => tokens.set(k, v),
    removeItem: k => tokens.delete(k)
  };
  const api = createAuthClient({
    baseURL: '/api',
    storage,
    refreshClient: {
      post: async () => {
        refreshes++;
        return refresh();
      }
    },
    onSessionExpired: () => expired++,
    progress: {
      start: () => starts++,
      done: () => dones++
    }
  });
  return {
    api,
    tokens,
    counts: () => ({
      expired,
      refreshes,
      starts,
      dones
    })
  };
}
const respond = (config, status = 200, data = {
  ok: true
}) => ({
  status,
  data,
  config,
  headers: {},
  statusText: String(status)
});
function fail(config, status) {
  throw new AxiosError('test HTTP failure', undefined, config, undefined, respond(config, status));
}
test('concurrent 401 requests share one refresh and retry with fresh token', async () => {
  let resolveRefresh;
  const h = harness(() => new Promise(resolve => {
    resolveRefresh = resolve;
  }));
  h.api.defaults.adapter = async config => config.headers.Authorization === 'Bearer fresh-token' ? respond(config) : fail(config, 401);
  const first = h.api.get('/first'),
    second = h.api.get('/second');
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(h.counts().refreshes, 1);
  resolveRefresh({
    data: {
      accessToken: 'fresh-token'
    }
  });
  const result = await Promise.all([first, second]);
  assert.equal(result.length, 2);
  assert.equal(h.tokens.get('accessToken'), 'fresh-token');
  assert.equal(h.counts().expired, 0);
});
test('403 forbidden and 500 errors reject without refresh', async () => {
  const h = harness();
  for (const status of [400, 403, 500]) {
    h.api.defaults.adapter = async c => fail(c, status);
    await assert.rejects(h.api.get('/protected'));
  }
  assert.equal(h.counts().refreshes, 0);
  assert.equal(h.counts().expired, 0);
  assert.equal(h.counts().starts, h.counts().dones);
});
test('missing refresh token expires session and releases subsequent requests', async () => {
  const h = harness();
  h.tokens.delete('refreshToken');
  h.api.defaults.adapter = async c => fail(c, 401);
  await assert.rejects(h.api.get('/first'));
  await assert.rejects(h.api.get('/second'));
  assert.equal(h.counts().refreshes, 0);
  assert.equal(h.counts().expired, 2);
});
test('failed refresh rejects whole queue and a later login can refresh', async () => {
  let shouldFail = true;
  const h = harness(async () => {
    if (shouldFail) {
      const e = new Error('expired');
      e.response = {
        status: 401
      };
      throw e;
    }
    return {
      data: {
        accessToken: 'fresh-token'
      }
    };
  });
  h.api.defaults.adapter = async c => c.headers.Authorization === 'Bearer fresh-token' ? respond(c) : fail(c, 401);
  const result = await Promise.allSettled([h.api.get('/one'), h.api.get('/two')]);
  assert.ok(result.every(r => r.status === 'rejected'));
  h.tokens.set('accessToken', 'old-token');
  h.tokens.set('refreshToken', 'new-login-refresh');
  shouldFail = false;
  await h.api.get('/three');
  assert.equal(h.tokens.get('accessToken'), 'fresh-token');
});
test('network failure during refresh preserves credentials for retry', async () => {
  const h = harness(async () => {
    throw new Error('network offline');
  });
  h.api.defaults.adapter = async c => fail(c, 401);
  await assert.rejects(h.api.get('/one'));
  assert.equal(h.tokens.get('refreshToken'), 'refresh-token');
  assert.equal(h.counts().expired, 0);
});
test('a retry is not refreshed forever', async () => {
  const h = harness();
  h.api.defaults.adapter = async c => fail(c, 401);
  await assert.rejects(h.api.get('/one'));
  assert.equal(h.counts().refreshes, 1);
  assert.equal(h.counts().expired, 1);
});
test('late refresh cannot overwrite credentials of another login', async () => {
  let resolveRefresh;
  const h = harness(() => new Promise(resolve => {
    resolveRefresh = resolve;
  }));
  h.api.defaults.adapter = async c => fail(c, 401);
  const request = h.api.get('/one');
  await new Promise(resolve => setTimeout(resolve, 5));
  h.tokens.set('refreshToken', 'another-session');
  h.tokens.set('accessToken', 'another-access');
  resolveRefresh({
    data: {
      accessToken: 'obsolete'
    }
  });
  await assert.rejects(request);
  assert.equal(h.tokens.get('accessToken'), 'another-access');
  assert.equal(h.counts().expired, 0);
});
test('relative images follow configured API origin and unsafe schemes rejected', () => {
  assert.equal(resolveAssetUrl('uploads/question.png', 'https://api.example.test/api', 'https://web.example.test'), 'https://api.example.test/uploads/question.png');
  assert.equal(resolveAssetUrl('/uploads/q.png', '/api', 'https://web.example.test'), 'https://web.example.test/uploads/q.png');
  assert.equal(resolveAssetUrl('https://cdn.example.test/a.png', '/api', 'https://web.example.test'), 'https://cdn.example.test/a.png');
  assert.equal(resolveAssetUrl('javascript:alert(1)', '/api', 'https://web.example.test'), '');
});

test('normalizeApiBaseUrl appends /api to origin-only URLs', () => {
  assert.equal(
    normalizeApiBaseUrl('https://nosqlproject-hfc6.onrender.com'),
    'https://nosqlproject-hfc6.onrender.com/api'
  );
  assert.equal(
    normalizeApiBaseUrl('https://nosqlproject-hfc6.onrender.com/'),
    'https://nosqlproject-hfc6.onrender.com/api'
  );
  assert.equal(
    normalizeApiBaseUrl('https://nosqlproject-hfc6.onrender.com///'),
    'https://nosqlproject-hfc6.onrender.com/api'
  );
  assert.equal(
    normalizeApiBaseUrl('http://localhost:3000'),
    'http://localhost:3000/api'
  );
  assert.equal(
    normalizeApiBaseUrl('http://localhost:3000/'),
    'http://localhost:3000/api'
  );
});

test('normalizeApiBaseUrl handles /api with whitespace and trailing slashes', () => {
  assert.equal(
    normalizeApiBaseUrl('  https://nosqlproject-hfc6.onrender.com/api  '),
    'https://nosqlproject-hfc6.onrender.com/api'
  );
  assert.equal(
    normalizeApiBaseUrl('  https://nosqlproject-hfc6.onrender.com/api/  '),
    'https://nosqlproject-hfc6.onrender.com/api'
  );
  assert.equal(
    normalizeApiBaseUrl('https://nosqlproject-hfc6.onrender.com/api///'),
    'https://nosqlproject-hfc6.onrender.com/api'
  );
  assert.equal(
    normalizeApiBaseUrl('  /api/  '),
    '/api'
  );
  assert.equal(
    normalizeApiBaseUrl('/api///'),
    '/api'
  );
});

test('normalizeApiBaseUrl handles same-origin /api', () => {
  assert.equal(normalizeApiBaseUrl('/api'), '/api');
  assert.equal(normalizeApiBaseUrl('/api/'), '/api');
  assert.equal(normalizeApiBaseUrl('  /api  '), '/api');
});

test('normalizeApiBaseUrl preserves explicit non-root custom base paths', () => {
  assert.equal(
    normalizeApiBaseUrl('https://example.com/custom'),
    'https://example.com/custom'
  );
  assert.equal(
    normalizeApiBaseUrl('https://example.com/custom/'),
    'https://example.com/custom'
  );
  assert.equal(
    normalizeApiBaseUrl('https://example.com/custom/api'),
    'https://example.com/custom/api'
  );
  assert.equal(
    normalizeApiBaseUrl('https://example.com/custom/api/'),
    'https://example.com/custom/api'
  );
  assert.equal(
    normalizeApiBaseUrl('https://nosqlproject-hfc6.onrender.com/v1'),
    'https://nosqlproject-hfc6.onrender.com/v1'
  );
  assert.equal(normalizeApiBaseUrl('/custom'), '/custom');
  assert.equal(normalizeApiBaseUrl('/api/v1'), '/api/v1');
});

test('normalizeApiBaseUrl resolves empty and undefined defaults for dev and production', () => {
  assert.equal(normalizeApiBaseUrl(undefined, true), '/api');
  assert.equal(normalizeApiBaseUrl('', true), '/api');
  assert.equal(normalizeApiBaseUrl('   ', true), '/api');
  assert.equal(normalizeApiBaseUrl(null, true), '/api');

  assert.equal(
    normalizeApiBaseUrl(undefined, false),
    'https://nosqlproject-hfc6.onrender.com/api'
  );
  assert.equal(
    normalizeApiBaseUrl('', false),
    'https://nosqlproject-hfc6.onrender.com/api'
  );
  assert.equal(
    normalizeApiBaseUrl('   ', false),
    'https://nosqlproject-hfc6.onrender.com/api'
  );
  assert.equal(
    normalizeApiBaseUrl(null, false),
    'https://nosqlproject-hfc6.onrender.com/api'
  );

  // Fallback when no dev mode provided in test environment
  assert.equal(API_BASE_URL, 'https://nosqlproject-hfc6.onrender.com/api');
});

test('normalizeApiBaseUrl rejects invalid inputs with configuration errors', () => {
  for (const value of ['https://user:pass@example.com/api', '/api bad', '/\\example.com']) {
    assert.throws(() => normalizeApiBaseUrl(value), /Invalid API base URL configuration/);
  }
  // Protocol-relative URLs
  assert.throws(
    () => normalizeApiBaseUrl('//nosqlproject-hfc6.onrender.com'),
    /protocol-relative/i
  );
  assert.throws(
    () => normalizeApiBaseUrl('//evil.com/api'),
    /protocol-relative/i
  );

  // Unsupported schemes
  assert.throws(
    () => normalizeApiBaseUrl('javascript:alert(1)'),
    /unsupported scheme/i
  );
  assert.throws(
    () => normalizeApiBaseUrl('ftp://example.com'),
    /unsupported scheme/i
  );
  assert.throws(
    () => normalizeApiBaseUrl('file:///etc/passwd'),
    /unsupported scheme/i
  );

  // Query parameters and hash fragments
  assert.throws(
    () => normalizeApiBaseUrl('https://example.com/api?debug=1'),
    /query/i
  );
  assert.throws(
    () => normalizeApiBaseUrl('https://example.com/api#section'),
    /hash/i
  );
  assert.throws(
    () => normalizeApiBaseUrl('/api?debug=1'),
    /query/i
  );
  assert.throws(
    () => normalizeApiBaseUrl('/api#fragment'),
    /hash/i
  );

  // Malformed values
  assert.throws(
    () => normalizeApiBaseUrl('http://'),
    /malformed/i
  );
  assert.throws(
    () => normalizeApiBaseUrl('not-a-valid-url'),
    /malformed/i
  );
  assert.throws(
    () => normalizeApiBaseUrl('api'),
    /malformed/i
  );
  assert.throws(
    () => normalizeApiBaseUrl(12345),
    /expected string/i
  );
});

test('Axios and createAuthClient resolve correct endpoint URLs with getUri', () => {
  // Scenario 1: Bare origin configuration (fixed deployment behavior)
  const normalizedRenderBase = normalizeApiBaseUrl('https://nosqlproject-hfc6.onrender.com');
  const prodAxios = axios.create({ baseURL: normalizedRenderBase });
  const prodAuthClient = createAuthClient({
    baseURL: normalizedRenderBase,
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    refreshClient: prodAxios
  });

  assert.equal(
    prodAxios.getUri({ url: '/subjects' }),
    'https://nosqlproject-hfc6.onrender.com/api/subjects'
  );
  assert.equal(
    prodAuthClient.getUri({ url: '/subjects' }),
    'https://nosqlproject-hfc6.onrender.com/api/subjects'
  );

  assert.equal(
    prodAxios.getUri({ url: '/quizzes/id/attempt' }),
    'https://nosqlproject-hfc6.onrender.com/api/quizzes/id/attempt'
  );
  assert.equal(
    prodAuthClient.getUri({ url: '/quizzes/id/attempt' }),
    'https://nosqlproject-hfc6.onrender.com/api/quizzes/id/attempt'
  );

  assert.equal(
    prodAxios.getUri({ url: '/submissions' }),
    'https://nosqlproject-hfc6.onrender.com/api/submissions'
  );
  assert.equal(
    prodAuthClient.getUri({ url: '/submissions' }),
    'https://nosqlproject-hfc6.onrender.com/api/submissions'
  );

  assert.equal(
    prodAxios.getUri({ url: '/auth/refresh' }),
    'https://nosqlproject-hfc6.onrender.com/api/auth/refresh'
  );
  assert.equal(
    prodAuthClient.getUri({ url: '/auth/refresh' }),
    'https://nosqlproject-hfc6.onrender.com/api/auth/refresh'
  );

  // Scenario 2: Dev same-origin /api configuration
  const devBase = normalizeApiBaseUrl('/api');
  const devAxios = axios.create({ baseURL: devBase });
  const devAuthClient = createAuthClient({
    baseURL: devBase,
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    refreshClient: devAxios
  });

  assert.equal(devAxios.getUri({ url: '/subjects' }), '/api/subjects');
  assert.equal(devAuthClient.getUri({ url: '/subjects' }), '/api/subjects');

  assert.equal(devAxios.getUri({ url: '/quizzes/id/attempt' }), '/api/quizzes/id/attempt');
  assert.equal(devAuthClient.getUri({ url: '/quizzes/id/attempt' }), '/api/quizzes/id/attempt');

  assert.equal(devAxios.getUri({ url: '/submissions' }), '/api/submissions');
  assert.equal(devAuthClient.getUri({ url: '/submissions' }), '/api/submissions');

  assert.equal(devAxios.getUri({ url: '/auth/refresh' }), '/api/auth/refresh');
  assert.equal(devAuthClient.getUri({ url: '/auth/refresh' }), '/api/auth/refresh');
});
