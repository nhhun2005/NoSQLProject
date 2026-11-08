import test from 'node:test';
import assert from 'node:assert/strict';
import { getQuestionValidationErrors } from '../src/utils/contributionQuestions.js';
import { validateSubmitQuestions } from '../backend/utils/contributionValidation.js';

const question = { question: 'Các bước trong kỹ thuật tái kiến tạo', options: ['Forward Engineering', 'Reverse Engineering', 'Restructuring'], answer: 'Forward Engineering' };

test('preview and submit reject joined answers and accept an explicitly corrected single choice', () => {
  const invalid = { ...question, answer: question.options.join(';') };
  assert.ok(getQuestionValidationErrors(invalid).some(error => error.includes('một đáp án')));
  assert.throws(() => validateSubmitQuestions([invalid]));
  const corrected = { ...question, options: [...question.options, 'Cả ba phương án trên'], answer: 'Cả ba phương án trên' };
  assert.deepEqual(getQuestionValidationErrors(corrected), []);
  assert.equal(validateSubmitQuestions([corrected])[0].answer, corrected.answer);
});

test('preview and server agree on invalid option structure without hiding invalid choices', () => {
  const cases = [
    { ...question, options: ['A'], answer: 'A' },
    { ...question, options: ['A', ' '], answer: 'A' },
    { ...question, options: ['A', ' A '], answer: 'A' },
    { ...question, options: ['A', null], answer: 'A' },
    { ...question, options: Array.from({ length: 9 }, (_, i) => String(i)), answer: '0' },
    { ...question, question: '' },
    { ...question, answer: '' },
    { ...question, explain: 123 },
  ];
  for (const value of cases) {
    assert.ok(getQuestionValidationErrors(value).length > 0);
    assert.throws(() => validateSubmitQuestions([value]));
  }
});

test('a semicolon inside a matching option is valid and whitespace normalization is consistent', () => {
  for (const value of [question, { ...question, options: ['A;B', 'C'], answer: 'A;B' }, { ...question, answer: ' Forward Engineering ' }]) {
    assert.deepEqual(getQuestionValidationErrors(value), []);
    assert.equal(validateSubmitQuestions([value]).length, 1);
  }
});
