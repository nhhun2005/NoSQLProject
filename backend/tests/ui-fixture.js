// Isolated browser-test fixture. All models are in-memory; never connect MongoDB.
import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Subject from '../models/subject.js';
import Chapter from '../models/chapter.js';
import Quiz from '../models/quiz.js';
import Question from '../models/questionText.js';
import QuestionImage from '../models/questionImage.js';
import Submission from '../models/submission.js';
import authRoutes from '../routes/authRoutes.js';
import subjectRoutes from '../routes/subjectRoutes.js';
import chapterRoutes from '../routes/chapterRoutes.js';
import quizRoutes from '../routes/quizRoutes.js';
import submissionRoutes from '../routes/submissionRoutes.js';
process.env.JWT_SECRET = 'ui-fixture-only-access-secret';
process.env.JWT_REFRESH_SECRET = 'ui-fixture-only-refresh-secret';
mongoose.connect = async () => {
  throw Error('UI fixture may not connect to MongoDB');
};
mongoose.Model.prototype.save = async () => {
  throw Error('Unmocked DB write blocked by UI fixture');
};
const ids = {
  user: '111111111111111111111111',
  admin: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  subject: '222222222222222222222222',
  chapter: '333333333333333333333333',
  quiz: '444444444444444444444444',
  q1: '555555555555555555555555',
  q2: '666666666666666666666666'
};
const doc = value => ({
  ...value,
  toObject() {
    return Object.fromEntries(Object.entries(this).filter(([, v]) => typeof v !== 'function'));
  }
});
const hash = await bcrypt.hash('FixtureOnly!42', 4);
const users = [doc({
  _id: ids.user,
  username: 'Fixture User',
  email: 'fixture.user@example.test',
  password: hash,
  role: 'User',
  active: true,
  status: 'normal'
}), doc({
  _id: ids.admin,
  username: 'Fixture Admin',
  email: 'fixture.admin@example.test',
  password: hash,
  role: 'Admin',
  active: true,
  status: 'normal'
})];
const stores = new Map([[User, users], [Subject, [doc({
  _id: ids.subject,
  name: 'Môn học kiểm thử',
  description: 'Dữ liệu giả lập, không có DB',
  image: '/quizLogo_green.svg',
  availability: true
})]], [Chapter, [doc({
  _id: ids.chapter,
  subjectId: ids.subject,
  name: 'Chương kiểm thử',
  availability: true
})]], [Quiz, [doc({
  _id: ids.quiz,
  subjectId: ids.subject,
  chapterId: ids.chapter,
  name: 'Bộ đề kiểm thử',
  timeLimit: 5,
  questionNum: 2,
  availability: true
})]], [Question, [doc({
  _id: ids.q1,
  quizId: ids.quiz,
  question: '2 + 2 bằng bao nhiêu?',
  options: ['4', '5'],
  answer: '4',
  explain: '2 cộng 2 bằng 4.'
}), doc({
  _id: ids.q2,
  quizId: ids.quiz,
  question: '3 + 3 bằng bao nhiêu?',
  options: ['6', '7'],
  answer: '6',
  explain: '3 cộng 3 bằng 6.'
})]], [QuestionImage, []], [Submission, []]]);
function matches(value, filter = {}) {
  return Object.entries(filter).every(([key, wanted]) => {
    if (key === '$or') return wanted.some(part => matches(value, part));
    const actual = value[key]?._id || value[key];
    if (wanted && typeof wanted === 'object') {
      if ('$in' in wanted) return wanted.$in.some(id => String(id) === String(actual));
      if ('$ne' in wanted) return actual !== wanted.$ne;
      if ('$regex' in wanted) return wanted.$regex.test(actual);
    }
    return String(actual) === String(wanted);
  });
}
function query(value) {
  return {
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
    select() {
      return this;
    },
    sort() {
      return this;
    },
    lean() {
      return this;
    },
    populate() {
      return this;
    }
  };
}
let serial = 100;
for (const [model, store] of stores) {
  model.find = filter => query(store.filter(value => matches(value, filter)));
  model.findOne = filter => query(store.find(value => matches(value, filter)) || null);
  model.findById = id => query(store.find(value => String(value._id) === String(id)) || null);
  model.findOneAndUpdate = (filter, update, options = {}) => {
    let value = store.find(value => matches(value, filter));
    if (!value && options.upsert) {
      value = doc({
        _id: (serial++).toString(16).padStart(24, '0'),
        ...filter,
        ...update.$setOnInsert
      });
      store.push(value);
    }
    if (value) {
      Object.assign(value, update.$set || update);
      if (update.$max) for (const [key, score] of Object.entries(update.$max)) value[key] = Math.max(value[key] ?? 0, score);
      value.updatedAt = new Date();
    }
    return query(value || null);
  };
  model.findByIdAndUpdate = (id, update, options) => model.findOneAndUpdate({
    _id: id
  }, update, options);
  model.deleteMany = filter => {
    let count = 0;
    for (let i = store.length - 1; i >= 0; i--) if (matches(store[i], filter)) {
      store.splice(i, 1);
      count++;
    }
    return query({
      deletedCount: count
    });
  };
  model.findByIdAndDelete = id => {
    const index = store.findIndex(value => String(value._id) === String(id));
    return query(index < 0 ? null : store.splice(index, 1)[0]);
  };
  model.create = async value => {
    const created = doc({
      _id: (serial++).toString(16).padStart(24, '0'),
      ...value
    });
    store.push(created);
    return created;
  };
}
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  if (req.method === 'POST' && ['/api/auth/register', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/verify-otp'].includes(req.path)) return res.status(405).json({
    message: 'Không gửi email hoặc đổi mật khẩu trong UI fixture.'
  });
  next();
});
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/submissions', submissionRoutes);
app.use((_error, _req, res, _next) => res.status(500).json({
  message: 'Fixture request failed'
}));
app.listen(3001, '127.0.0.1', () => console.log('UI fixture listening on 127.0.0.1:3001 (no database)'));
