import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Quiz from '../models/quiz.js';
import Question from '../models/questionText.js';
import QuestionImage from '../models/questionImage.js';
import Chapter from '../models/chapter.js';
import Subject from '../models/subject.js';
import Submission from '../models/submission.js';
import { addSubmission, getAllSubmissionFromSubject } from '../controllers/submissionController.js';
import { getQuizById, createQuizAttempt, reviewQuiz, updateQuizFull } from '../controllers/quizController.js';
import { createAttempt, clearAllAttempts, getAttempt } from '../utils/attemptStore.js';
const uid = '111111111111111111111111',
  qid = '222222222222222222222222',
  questionId = '333333333333333333333333',
  sid = '444444444444444444444444',
  cid = '555555555555555555555555';
const question = {
  _id: questionId,
  quizId: qid,
  question: '2 + 2?',
  options: ['4', '5'],
  answer: '4',
  explain: 'Cộng hai số'
};
const quiz = {
  _id: qid,
  name: 'Quiz',
  subjectId: sid,
  chapterId: cid,
  timeLimit: 5,
  availability: true,
  toObject() {
    const {
      toObject: _toObject,
      ...plain
    } = this;
    return plain;
  }
};
function request(body = {}, params = {
  id: qid
}, role = 'User') {
  return {
    body,
    params,
    user: {
      id: uid,
      role
    },
    headers: {}
  };
}
function response() {
  return {
    statusCode: 200,
    data: null,
    status(s) {
      this.statusCode = s;
      return this;
    },
    json(d) {
      this.data = d;
      return this;
    }
  };
}
function attempt(scoreMode = true) {
  return createAttempt({
    quizId: qid,
    userId: uid,
    scoreMode,
    timeLimitMinutes: 5,
    questions: [question, {
      ...question,
      _id: '666666666666666666666666'
    }]
  }).attempt;
}
test('server grading, review privacy and editor regression', async t => {
  t.beforeEach(() => {
    clearAllAttempts();
    t.mock.method(mongoose, 'connect', () => {
      throw Error('Tests must never connect to a DB');
    });
  });
  t.afterEach(() => t.mock.restoreAll());
  await t.test('forged score/flags/time are ignored; missing answers reduce score', async () => {
    const a = attempt();
    let update;
    t.mock.method(Submission, 'findOneAndUpdate', async (query, value, options) => {
      assert.equal(query.userId, uid);
      assert.equal(options.runValidators, true);
      update = value;
      return value.$set;
    });
    const req = request({
      quizId: qid,
      attemptId: a.attemptId,
      score: 100,
      timeSpent: 99999,
      totalQuestions: 999,
      answers: [{
        questionId,
        selectedOption: '4',
        isCorrect: false
      }]
    });
    const res = response();
    await addSubmission(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(update.$set.score, 50);
    assert.equal(update.$max.bestScore, 50);
    assert.equal(update.$set.totalQuestions, 2);
    assert.equal(update.$set.answers.length, 1);
    assert.equal(update.$set.answers[0].isCorrect, true);
    assert.ok(update.$set.timeSpent < 10);
  });
  await t.test('spoofed userId and foreign attempt cannot write', async () => {
    const spy = t.mock.method(Submission, 'findOneAndUpdate', async () => {
      throw Error('unauthorized DB write');
    });
    const a = attempt();
    for (const body of [{
      userId: 'other',
      quizId: qid,
      attemptId: a.attemptId,
      answers: []
    }, {
      quizId: qid,
      attemptId: a.attemptId,
      answers: []
    }]) {
      const req = request(body);
      if (!body.userId) req.user.id = 'other';
      const res = response();
      await addSubmission(req, res);
      assert.equal(res.statusCode, 403);
    }
    assert.equal(spy.mock.callCount(), 0);
  });
  await t.test('invalid, duplicate or foreign answers rejected before write and claim released', async () => {
    const a = attempt();
    const spy = t.mock.method(Submission, 'findOneAndUpdate', async () => {
      throw Error('invalid DB write');
    });
    for (const answers of [[{
      questionId,
      selectedOption: 'X'
    }], [{
      questionId,
      selectedOption: '4'
    }, {
      questionId,
      selectedOption: '5'
    }], [{
      questionId: 'bad-id',
      selectedOption: '4'
    }], [null]]) {
      const res = response();
      await addSubmission(request({
        quizId: qid,
        attemptId: a.attemptId,
        answers
      }), res);
      assert.equal(res.statusCode, 400);
      assert.equal(a.claimed, false);
    }
    assert.equal(spy.mock.callCount(), 0);
  });
  await t.test('practice and expired attempts cannot persist', async () => {
    const spy = t.mock.method(Submission, 'findOneAndUpdate', async () => {
      throw Error('invalid DB write');
    });
    const practice = attempt(false),
      expired = attempt();
    expired.expiresAt = new Date(Date.now() - 1000);
    for (const [a, status] of [[practice, 410], [expired, 410]]) {
      const res = response();
      await addSubmission(request({
        quizId: qid,
        attemptId: a.attemptId,
        answers: []
      }), res);
      assert.equal(res.statusCode, status);
    }
    assert.equal(spy.mock.callCount(), 0);
  });
  await t.test('successful replay is idempotent and concurrent submission is rejected', async () => {
    const a = attempt();
    let finish;
    const spy = t.mock.method(Submission, 'findOneAndUpdate', () => new Promise(resolve => {
      finish = resolve;
    }));
    const req = request({
      quizId: qid,
      attemptId: a.attemptId,
      answers: []
    });
    const first = response();
    const pending = addSubmission(req, first);
    const busy = response();
    await addSubmission(req, busy);
    assert.equal(busy.statusCode, 409);
    finish({
      score: 0
    });
    await pending;
    const replay = response();
    await addSubmission(req, replay);
    assert.deepEqual(replay.data, first.data);
    assert.equal(spy.mock.callCount(), 1);
  });
  await t.test('persistence failure releases claim and allows same attempt to retry', async () => {
    const a = attempt();
    let calls = 0;
    t.mock.method(Submission, 'findOneAndUpdate', async () => {
      if (++calls === 1) throw Error('fake storage error');
      return {
        score: 0
      };
    });
    const req = request({
      quizId: qid,
      attemptId: a.attemptId,
      answers: []
    });
    const fail = response();
    await addSubmission(req, fail);
    assert.equal(fail.statusCode, 500);
    assert.equal(a.claimed, false);
    const retry = response();
    await addSubmission(req, retry);
    assert.equal(retry.statusCode, 200);
    assert.equal(calls, 2);
  });
  await t.test('statistics derives quiz IDs and never queries absent Submission fields', async () => {
    t.mock.method(Quiz, 'find', query => {
      assert.deepEqual(query, {
        subjectId: sid
      });
      return {
        select: async () => [{
          _id: qid
        }]
      };
    });
    t.mock.method(Submission, 'find', query => {
      assert.deepEqual(query, {
        userId: uid,
        quizId: {
          $in: [qid]
        }
      });
      return {
        populate: async field => {
          assert.equal(field, 'quizId');
          return [];
        }
      };
    });
    const res = response();
    await getAllSubmissionFromSubject(request({}, {
      userId: uid,
      subjectId: sid
    }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.data, []);
  });
  await t.test('statistics rejects another user before any read', async () => {
    const spy = t.mock.method(Quiz, 'find', () => {
      throw Error('private read');
    });
    const res = response();
    await getAllSubmissionFromSubject(request({}, {
      userId: 'another',
      subjectId: sid
    }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(spy.mock.callCount(), 0);
  });
  function mockQuizRead() {
    t.mock.method(Quiz, 'findById', async () => quiz);
    t.mock.method(Subject, 'findById', async () => ({
      availability: true
    }));
    t.mock.method(Chapter, 'findById', async () => ({
      _id: cid,
      subjectId: sid,
      availability: true
    }));
    t.mock.method(Question, 'find', async () => [question]);
    t.mock.method(QuestionImage, 'find', async () => []);
  }
  await t.test('normal quiz metadata strips answers; scored attempt strips and practice intentionally reveals', async () => {
    mockQuizRead();
    const meta = response();
    await getQuizById(request(), meta);
    assert.equal(meta.data.questions[0].answer, undefined);
    assert.equal(meta.data.questions[0].explain, undefined);
    for (const scoreMode of [true, false]) {
      const res = response();
      await createQuizAttempt(request({
        scoreMode
      }), res);
      assert.equal(res.statusCode, 201);
      assert.equal(res.data.questions, undefined);
      assert.equal(res.data.quiz.questions[0].answer, scoreMode ? undefined : '4');
      assert.equal(Boolean(getAttempt(res.data.attemptId)), scoreMode);
    }
  });
  await t.test('hidden/missing parent rejects attempts, no empty/invalid scored quiz starts', async () => {
    mockQuizRead();
    Subject.findById = async () => null;
    const hidden = response();
    await createQuizAttempt(request({
      scoreMode: true
    }), hidden);
    assert.equal(hidden.statusCode, 403);
    Subject.findById = async () => ({
      availability: true
    });
    const badType = response();
    await createQuizAttempt(request({
      scoreMode: 'true'
    }), badType);
    assert.equal(badType.statusCode, 400);
    Question.find = async () => [];
    const empty = response();
    await createQuizAttempt(request({
      scoreMode: true
    }), empty);
    assert.equal(empty.statusCode, 400);
  });
  await t.test('review requires saved submission for a normal user', async () => {
    mockQuizRead();
    t.mock.method(Submission, 'findOne', async () => null);
    const res = response();
    await reviewQuiz(request(), res);
    assert.equal(res.statusCode, 403);
  });
  function mockEditor() {
    mockQuizRead();
    t.mock.method(Quiz, 'findByIdAndUpdate', async (_id, update) => ({
      ...quiz,
      ...update
    }));
    t.mock.method(Question, 'findByIdAndUpdate', async () => question);
    t.mock.method(Question, 'deleteMany', async () => ({
      deletedCount: 1
    }));
    t.mock.method(QuestionImage, 'deleteMany', async () => ({
      deletedCount: 0
    }));
  }
  await t.test('invalid content or foreign question ID never writes or deletes', async () => {
    mockEditor();
    const spy = t.mock.method(QuestionImage, 'create', async () => {
      throw Error('must not write');
    });
    const write = Question.findByIdAndUpdate;
    for (const changes of [{
      _id: '777777777777777777777777'
    }, {
      answer: 'invalid'
    }, {
      options: ['4', '4']
    }, {
      image: {
        bad: true
      }
    }]) {
      const res = response();
      await updateQuizFull(request({
        name: 'Quiz',
        chapterId: cid,
        timeLimit: 5,
        questions: [{
          ...question,
          ...changes
        }]
      }), res);
      assert.equal(res.statusCode, 400);
    }
    assert.equal(spy.mock.callCount(), 0);
    assert.equal(write.mock.callCount(), 0);
    assert.equal(Question.deleteMany.mock.callCount(), 0);
  });
  await t.test('omitted question deletion is scoped to quiz, question count updated', async () => {
    mockEditor();
    let deletion;
    t.mock.method(Question, 'deleteMany', async filter => {
      deletion = filter;
      return {
        deletedCount: 1
      };
    });
    const res = response();
    await updateQuizFull(request({
      name: 'Quiz',
      chapterId: cid,
      timeLimit: 5,
      questions: []
    }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(deletion, {
      _id: {
        $in: [questionId]
      },
      quizId: qid
    });
    assert.equal(res.data.updatedQuiz.questionNum, 0);
  });
  await t.test('text-image conversion retains ID and creates destination before removing source', async () => {
    mockEditor();
    const actions = [];
    t.mock.method(QuestionImage, 'create', async doc => {
      actions.push('create');
      assert.equal(doc._id, questionId);
      assert.equal(doc.quizId, qid);
      return doc;
    });
    t.mock.method(Question, 'findByIdAndDelete', async id => {
      actions.push('delete');
      assert.equal(id, questionId);
      return question;
    });
    const res = response();
    await updateQuizFull(request({
      name: 'Quiz',
      chapterId: cid,
      timeLimit: 5,
      questions: [{
        ...question,
        image: 'https://example.test/q.png'
      }]
    }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(actions, ['create', 'delete']);
  });
  await t.test('destination failure never deletes source or omitted questions', async () => {
    mockEditor();
    t.mock.method(QuestionImage, 'create', async () => {
      throw Error('fake destination failure');
    });
    const deletion = t.mock.method(Question, 'findByIdAndDelete', async () => {});
    const res = response();
    await updateQuizFull(request({
      name: 'Quiz',
      chapterId: cid,
      timeLimit: 5,
      questions: [{
        ...question,
        image: 'https://example.test/q.png'
      }]
    }), res);
    assert.equal(res.statusCode, 500);
    assert.equal(deletion.mock.callCount(), 0);
    assert.equal(Question.deleteMany.mock.callCount(), 0);
    assert.equal(res.data.error, undefined);
  });
});
