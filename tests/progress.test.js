import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProgress } from '../src/utils/progressStats.js';
import { safeReturnTo } from '../src/utils/authValidation.js';
test('progress uses completed quiz weighting, real zero and no-data distinctly', () => {
  const chapters = [{
    _id: 'a',
    name: 'A',
    quizzes: [{
      _id: 'q1'
    }, {
      _id: 'q2'
    }]
  }, {
    _id: 'b',
    name: 'B',
    quizzes: [{
      _id: 'q3'
    }, {
      _id: 'q4'
    }]
  }, {
    _id: 'c',
    name: 'C',
    quizzes: [{
      _id: 'q5'
    }]
  }];
  const summary = summarizeProgress(chapters, [{
    quizId: 'q1',
    score: 50,
    bestScore: 100
  }, {
    quizId: {
      _id: 'q2'
    },
    bestScore: 80
  }, {
    quizId: 'q3',
    bestScore: 0
  }]);
  assert.equal(summary.completed, 3);
  assert.equal(summary.overall, 60);
  assert.equal(summary.data[0].avg, 90);
  assert.equal(summary.data[1].avg, 0);
  assert.equal(summary.data[2].avg, null);
});
test('duplicate legacy submissions use highest valid score; hidden quizzes excluded', () => {
  const summary = summarizeProgress([{
    name: 'A',
    quizzes: [{
      _id: 'q1'
    }, {
      _id: 'hidden',
      availability: false
    }]
  }], [{
    quizId: 'q1',
    bestScore: 50
  }, {
    quizId: 'q1',
    bestScore: 90
  }, {
    quizId: 'q1',
    bestScore: NaN
  }, {
    quizId: 'hidden',
    bestScore: 100
  }]);
  assert.equal(summary.completed, 1);
  assert.equal(summary.overall, 90);
  assert.equal(summarizeProgress([], []).overall, null);
});
test('login return target accepts internal paths and rejects external and login loops', () => {
  assert.equal(safeReturnTo('/subject/view/123?tab=quiz#chapter'), '/subject/view/123?tab=quiz#chapter');
  for (const value of ['https://evil.test', '//evil.test', '/login', '/register?next=x', '/forgot-password', null, {
    pathname: '/safe'
  }, '/' + String.fromCharCode(92) + 'evil.test', '/' + String.fromCharCode(10) + 'test']) assert.equal(safeReturnTo(value), '/about');
});
