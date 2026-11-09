import test from 'node:test';
import assert from 'node:assert/strict';
import { getPracticeRetryState } from '../src/utils/practiceRound.js';
const questions = [{ _id: 'a', answer: 'A' }, { _id: 'b', answer: 'B' }, { _id: 'c', answer: 'C' }];
test('mid-practice retry keeps wrong and unanswered questions, excluding correct ones', () => {
  const answers = { a: 'A', b: 'wrong' };
  const next = getPracticeRetryState(questions, answers);
  assert.deepEqual(next.questions.map(q => q._id), ['b', 'c']);
  assert.equal(next.wrong, 1);
  assert.equal(next.unanswered, 1);
  assert.equal(questions.length, 3);
  assert.deepEqual(answers, { a: 'A', b: 'wrong' });
});
test('retry before answering keeps all unfinished questions', () => {
  const next = getPracticeRetryState(questions, {});
  assert.deepEqual(next.questions, questions);
  assert.equal(next.unanswered, 3);
  assert.equal(next.wrong, 0);
});
test('all-correct round has no retry questions', () => {
  assert.deepEqual(getPracticeRetryState(questions, { a: 'A', b: 'B', c: 'C' }), { questions: [], wrong: 0, unanswered: 0 });
});
test('successive rounds shrink to remaining mistakes without losing unfinished work', () => {
  const second = getPracticeRetryState(questions, { a: 'A', b: 'wrong' });
  const third = getPracticeRetryState(second.questions, { b: 'B', c: 'wrong' });
  assert.deepEqual(third.questions.map(q => q._id), ['c']);
  assert.equal(getPracticeRetryState(third.questions, { c: 'C' }).questions.length, 0);
});
test('zero-like string answer is a real selection', () => {
  assert.equal(getPracticeRetryState([{ _id: 'zero', answer: '0' }], { zero: '0' }).questions.length, 0);
});
