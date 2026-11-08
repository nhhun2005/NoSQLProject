import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ContributedQuiz from '../models/contributedQuiz.js';
import Quiz from '../models/quiz.js';
import QuestionText from '../models/questionText.js';
import { approveContribution, handleCSVUpload } from '../controllers/contributeController.js';
import { importContributionPreview, submitContribution } from '../controllers/contributionImportController.js';
import { _resetImportLimitsForTesting } from '../utils/contributionImportLimits.js';
import { createMockReqRes } from './helpers.js';

const valid = { question: 'Q', options: ['A', 'B', 'C'], answer: 'A', explain: '' };
const joined = { ...valid, answer: 'A;B;C' };

test('legacy CSV rejects a bad row after a valid row without quota reads, writes or leftover files', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'contribution-regression-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  t.mock.method(ContributedQuiz, 'countDocuments', () => assert.fail('Invalid rows must fail before quota query'));
  t.mock.method(ContributedQuiz, 'create', () => assert.fail('Invalid rows must never be saved'));
  for (const row of ['Q2,A;B;C,A;B;C', ',A;B,A', 'Q2,A;;B,A', 'Q2,A;A,A']) {
    const filePath = path.join(dir, 'input.csv');
    fs.writeFileSync(filePath, `question,options,answer\nQ1,A;B,A\n${row}\n`);
    const { req, res } = createMockReqRes({ user: { id: 'test-user' } });
    req.file = { path: filePath };
    await handleCSVUpload(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.data.message, /Câu hỏi số 2/);
    assert.equal(fs.existsSync(filePath), false);
  }
});

test('approval revalidates legacy questions and performs zero writes for joined answers', async t => {
  let saves = 0;
  t.mock.method(ContributedQuiz, 'findById', async () => ({ questions: [valid, joined], save() { saves++; } }));
  const quizWrites = t.mock.method(Quiz, 'create', () => assert.fail('Must not publish invalid questions'));
  const questionWrites = t.mock.method(QuestionText, 'insertMany', () => assert.fail('Must not persist invalid questions'));
  const { req, res } = createMockReqRes({ params: { id: 'contribution' } });
  req.params = { id: 'contribution' };
  await approveContribution(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.data.message, /Câu hỏi số 2.*một đáp án/);
  assert.equal(quizWrites.mock.callCount(), 0);
  assert.equal(questionWrites.mock.callCount(), 0);
  assert.equal(saves, 0);
});

test('valid approval publishes sanitized single-choice questions and the matching count', async t => {
  const contrib = { name: 'Quiz', timeLimit: 45, questions: [{ ...valid, answer: ' A ', unexpected: true }], async save() {} };
  t.mock.method(ContributedQuiz, 'findById', async () => contrib);
  const quizWrites = t.mock.method(Quiz, 'create', async data => ({ ...data, _id: 'quiz-id' }));
  const questionWrites = t.mock.method(QuestionText, 'insertMany', async () => []);
  const save = t.mock.method(contrib, 'save');
  const { req, res } = createMockReqRes({ user: { _id: 'admin' } });
  req.params = { id: 'contribution' };
  await approveContribution(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.data.quizId, 'quiz-id');
  assert.equal(quizWrites.mock.calls[0].arguments[0].questionNum, 1);
  assert.deepEqual(questionWrites.mock.calls[0].arguments[0], [{ ...valid, quizId: 'quiz-id' }]);
  assert.equal(contrib.status, 'approved');
  assert.equal(save.mock.callCount(), 1);
});

test('CSV preview retains invalid answers and options, and warns with row numbers for repair', async t => {
  _resetImportLimitsForTesting();
  t.after(_resetImportLimitsForTesting);
  t.mock.method(ContributedQuiz, 'create', () => assert.fail('Preview must not save anything'));
  const { req, res } = createMockReqRes({ user: { id: 'preview-regression' } });
  req.file = { originalname: 'questions.csv', buffer: Buffer.from('question,options,answer\nQ1,A;B;C,A;B;C\nQ2,A;A,A\nQ3,A;;B,A\n,A;B,A\n') };
  await importContributionPreview(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.data.questions[0].answer, 'A;B;C');
  assert.deepEqual(res.data.questions[1].options, ['A', 'A']);
  assert.deepEqual(res.data.questions[2].options, ['A', '', 'B']);
  assert.ok(res.data.warnings.some(w => /Dòng 1.*một đáp án/.test(w)));
  assert.ok(res.data.warnings.some(w => /Dòng 2.*trùng/.test(w)));
  assert.ok(res.data.warnings.some(w => /Dòng 3.*trống/.test(w)));
  assert.equal(res.data.questions.length, 4);
  assert.equal(res.data.questions[3].question, '');
  assert.ok(res.data.warnings.some(w => /Dòng 4.*Nội dung/.test(w)));
});

test('final contribution submission rejects joined answers without creating a document', async t => {
  t.mock.method(ContributedQuiz, 'countDocuments', async () => 0);
  const create = t.mock.method(ContributedQuiz, 'create', () => assert.fail('Must not save invalid submission'));
  const { req, res } = createMockReqRes({ user: { id: 'user' }, body: { name: 'Quiz', suggestedSubject: 'Subject', suggestedChapter: 'Chapter', questions: [joined] } });
  await submitContribution(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.data.message, /Câu hỏi số 1.*một đáp án/);
  assert.equal(create.mock.callCount(), 0);
});
