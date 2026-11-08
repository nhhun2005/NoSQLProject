import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import subjectRoutes from '../routes/subjectRoutes.js';
import chapterRoutes from '../routes/chapterRoutes.js';
import quizRoutes from '../routes/quizRoutes.js';
import questionRoutes from '../routes/questionRoutes.js';
import imageRoutes from '../routes/questionImageRoutes.js';
import submissionRoutes from '../routes/submissionRoutes.js';
import { generateTokens } from '../utils/tokenState.js';
import { createRateLimiter } from '../utils/rateLimiter.js';
process.env.JWT_SECRET = 'http-guard-test-only-secret';
process.env.JWT_REFRESH_SECRET = 'http-guard-test-only-refresh';
const id = '111111111111111111111111';
test('HTTP routes reject all unauthorized content writes and private reads before DB access', async t => {
  let writes = 0;
  t.mock.method(mongoose.Query.prototype, 'exec', async () => {
    writes++;
    throw Error('Unexpected database operation in guard test');
  });
  const user = {
    _id: id,
    password: 'test-only-hash',
    active: true,
    status: 'normal',
    role: 'User'
  };
  t.mock.method(User, 'findById', async () => user);
  const token = generateTokens({
    ...user,
    role: 'Admin'
  }).accessToken;
  const app = express();
  app.use(express.json());
  for (const [name, routes] of [['subjects', subjectRoutes], ['chapters', chapterRoutes], ['quizzes', quizRoutes], ['questions', questionRoutes], ['questionImages', imageRoutes], ['submissions', submissionRoutes]]) app.use('/api/' + name, routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    t.mock.restoreAll();
  });
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const routes = [['POST', 'subjects'], ['PUT', `subjects/${id}`], ['DELETE', `subjects/${id}`], ['POST', 'chapters'], ['PUT', `chapters/${id}`], ['POST', 'quizzes'], ['PUT', `quizzes/${id}/full`], ['PUT', `quizzes/${id}/availability`], ['DELETE', `quizzes/${id}`], ['POST', 'questions'], ['DELETE', `questions/${id}`], ['POST', 'questionImages'], ['DELETE', `questionImages/${id}`], ['GET', 'questions'], ['GET', 'questionImages']];
  for (const [method, path] of routes) for (const authenticated of [false, true]) {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authenticated ? {
          Authorization: `Bearer ${token}`
        } : {})
      },
      ...(method === 'GET' ? {} : {
        body: '{}'
      })
    });
    assert.equal(response.status, authenticated ? 403 : 401, `${method} ${path}`);
  }
  for (const path of [`submissions/${id}`, `submissions/latest/${id}/${id}`, `submissions/best/${id}/${id}`, `submissions/subject/${id}/${id}`]) assert.equal((await fetch(base + path)).status, 401);
  assert.equal((await fetch(base + 'submissions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: '{}'
  })).status, 401);
  assert.equal(writes, 0);
});
test('JWT signing fails closed when secrets are missing', () => {
  const previous = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  try {
    assert.throws(() => generateTokens({
      _id: id,
      password: 'fake',
      role: 'User'
    }), /JWT_SECRET/);
  } finally {
    process.env.JWT_SECRET = previous;
  }
});
test('rate limit isolates accounts sharing a proxy IP and supplies retry delay', () => {
  const limit = createRateLimiter({
    max: 1,
    windowMs: 60000
  });
  let accepted = 0;
  const response = () => ({
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(s) {
      this.statusCode = s;
      return this;
    },
    json() {
      return this;
    }
  });
  const req = email => ({
    ip: '127.0.0.1',
    path: '/login',
    body: {
      email
    },
    headers: {}
  });
  const a = response();
  limit(req('a@example.test'), a, () => accepted++);
  const duplicate = response();
  limit(req('a@example.test'), duplicate, () => accepted++);
  const other = response();
  limit(req('b@example.test'), other, () => accepted++);
  assert.equal(accepted, 2);
  assert.equal(duplicate.statusCode, 429);
  assert.equal(duplicate.headers['Retry-After'], '60');
});
