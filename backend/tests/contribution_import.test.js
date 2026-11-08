import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import contributionRoutes from "../routes/contributeRoutes.js";
import { getCredentialVersion } from "../utils/tokenState.js";
import { parseContributionCSVBuffer } from "../utils/contributionCsv.js";
import {
  contributionUpload
} from "../middlewares/contributionUpload.js";
import {
  acquireImportSlot,
  releaseImportSlot,
  _resetImportLimitsForTesting
} from "../utils/contributionImportLimits.js";
import {
  validateSubmitQuestions,
  validateSubjectAndChapter,
  validateContributionSubmission,
  ValidationError
} from "../utils/contributionValidation.js";
import {
  importContributionPreview,
  submitContribution
} from "../controllers/contributionImportController.js";
import ContributedQuiz from "../models/contributedQuiz.js";
import Subject from "../models/subject.js";
import Chapter from "../models/chapter.js";
import { createMockReqRes } from "./helpers.js";

// ==========================================
// 1. File signature & Upload validation tests
// ==========================================
async function withHttpServer(app, run) {
  const server = await new Promise(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test("contributionUpload validates actual multipart uploads", async t => {
  const app = express();
  app.post("/upload", contributionUpload, (req, res) => res.json({ bytes: req.file.buffer.length }));
  await withHttpServer(app, async base => {
    const cases = [
      ["test.txt", Buffer.from("text"), 400],
      ["fake.pdf", Buffer.from("NOT-PDF"), 400],
      ["empty.csv", Buffer.alloc(0), 400],
      ["valid.pdf", Buffer.from("%PDF-1.7 Content"), 200],
      ["valid.csv", Buffer.from("question,options,answer\nQ,A;B,A"), 200],
      ["large.pdf", Buffer.alloc(10 * 1024 * 1024 + 1, 65), 400]
    ];
    for (const [name, content, status] of cases) {
      await t.test(name, async () => {
        const form = new FormData();
        form.append("file", new Blob([content]), name);
        const response = await fetch(`${base}/upload`, { method: "POST", body: form });
        assert.equal(response.status, status);
        await response.json();
      });
    }
  });
});

test("production contribution router accepts JSON larger than global 100kb limit", async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "contribution-http-test-only";
  const user = { _id: "111111111111111111111111", password: "test-hash", active: true, role: "User" };
  t.mock.method(User, "findById", async () => user);
  t.mock.method(ContributedQuiz, "countDocuments", async () => 0);
  let writes = 0;
  t.mock.method(ContributedQuiz, "create", async data => { writes++; return { _id: "test-quiz", ...data }; });
  const app = express();
  app.use("/api/contributed", contributionRoutes);
  app.use(express.json());
  const token = jwt.sign({ id: user._id, credentialVersion: getCredentialVersion(user.password) }, process.env.JWT_SECRET);
  try {
    await withHttpServer(app, async base => {
      const body = { name: "Long quiz", suggestedSubject: "Math", suggestedChapter: "Addition", questions: Array.from({ length: 30 }, () => ({ question: "q".repeat(4500), options: ["A", "B"], answer: "A" })) };
      assert.ok(Buffer.byteLength(JSON.stringify(body)) > 100 * 1024);
      const response = await fetch(`${base}/api/contributed/submit`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      assert.equal(response.status, 201, JSON.stringify(await response.json()));
      assert.equal(writes, 1);
    });
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test("submission validation rejects malformed types and lengths without any writes", async () => {
  const valid = { name: "Quiz", suggestedSubject: "Math", suggestedChapter: "Addition", questions: [{ question: "Q", options: ["A", "B"], answer: "A" }] };
  for (const timeLimit of [true, [], {}, 0, 301, 1.5]) {
    await assert.rejects(validateContributionSubmission({ ...valid, timeLimit }), ValidationError);
  }
  for (const options of [[{}, "B"], ["", "B"], ["A".repeat(2001), "B"]]) {
    assert.throws(() => validateSubmitQuestions([{ question: "Q", options, answer: "B" }]), ValidationError);
  }
  await assert.rejects(validateContributionSubmission({ ...valid, chapterId: "222222222222222222222222" }), ValidationError);
  await assert.rejects(validateContributionSubmission({ ...valid, note: "n".repeat(2001) }), ValidationError);
});

// ==========================================
// 2. CSV Buffer parser tests
// ==========================================
test("parseContributionCSVBuffer - parses UTF-8 BOM CSV buffer with quotes", async () => {
  const csvText = '\uFEFF"question","options","answer","explain"\n' +
    '"1 + 1 bằng mấy?","1;2;3;4","2","Phép cộng"\n';
  const buffer = Buffer.from(csvText, "utf8");

  const rows = await parseContributionCSVBuffer(buffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].question, "1 + 1 bằng mấy?");
  assert.equal(rows[0].options, "1;2;3;4");
  assert.equal(rows[0].answer, "2");
  assert.equal(rows[0].explain, "Phép cộng");
});

// ==========================================
// 3. In-flight and Rate limit tests
// ==========================================
test("Import limits - blocks concurrent import for same user and releases in finally", () => {
  _resetImportLimitsForTesting();
  const userId = "user_test_limit_1";

  const firstSlot = acquireImportSlot(userId);
  assert.equal(firstSlot.allowed, true);

  // Second concurrent import while first is in-flight must be rejected
  const secondSlot = acquireImportSlot(userId);
  assert.equal(secondSlot.allowed, false);
  assert.equal(secondSlot.status, 429);
  assert.match(secondSlot.message, /đang xử lý/i);

  // Release in-flight slot
  releaseImportSlot(userId);

  // Subsequent immediate import hits cooldown
  const cooldownSlot = acquireImportSlot(userId);
  assert.equal(cooldownSlot.allowed, false);
  assert.equal(cooldownSlot.status, 429);
  assert.match(cooldownSlot.message, /chờ/i);

  _resetImportLimitsForTesting();
});

// ==========================================
// 4. importContributionPreview endpoint tests
// ==========================================
test("importContributionPreview - CSV preview succeeds with NO database writes", async () => {
  _resetImportLimitsForTesting();

  // Spy on ContributedQuiz.create to guarantee NO model writes
  const originalCreate = ContributedQuiz.create;
  let createCalled = false;
  ContributedQuiz.create = async () => {
    createCalled = true;
    throw new Error("ContributedQuiz.create MUST NOT be called during import preview!");
  };

  try {
    const csvContent = "question,options,answer,explain\n" +
      "Câu hỏi 1,A;B;C;D,A,Giải thích 1\n" +
      "Câu hỏi 2,Đúng;Sai,Sai,Giải thích 2\n";

    const { req, res } = createMockReqRes({
      user: { id: "user_import_test" }
    });
    req.file = {
      originalname: "de_thi_toan.csv",
      buffer: Buffer.from(csvContent, "utf8")
    };

    await importContributionPreview(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(createCalled, false, "Database create must never be called during preview");
    assert.ok(res.data);
    assert.equal(res.data.name, "de_thi_toan");
    assert.equal(res.data.questions.length, 2);
    assert.equal(res.data.questions[0].question, "Câu hỏi 1");
    assert.deepEqual(res.data.questions[0].options, ["A", "B", "C", "D"]);
    assert.equal(res.data.questions[0].answer, "A");
  } finally {
    ContributedQuiz.create = originalCreate;
    _resetImportLimitsForTesting();
  }
});

test("importContributionPreview - allows missing answer in preview and generates warning", async () => {
  _resetImportLimitsForTesting();

  const csvContent = "question,options,answer,explain\n" +
    "Câu hỏi không có đáp án,Lựa chọn 1;Lựa chọn 2,,Giải thích\n";

  const { req, res } = createMockReqRes({
    user: { id: "user_import_no_ans" }
  });
  req.file = {
    originalname: "missing_ans.csv",
    buffer: Buffer.from(csvContent, "utf8")
  };

  await importContributionPreview(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.questions.length, 1);
  assert.equal(res.data.questions[0].answer, "");
  assert.ok(res.data.warnings.length > 0);
  assert.ok(res.data.warnings[0].includes("Chưa có đáp án đúng"));

  _resetImportLimitsForTesting();
});

// ==========================================
// 5. Question & Option Validation unit tests
// ==========================================
test("validateSubmitQuestions - rejects empty or missing question list", () => {
  assert.throws(
    () => validateSubmitQuestions([]),
    (err) => err instanceof ValidationError && err.status === 400
  );
});

test("validateSubmitQuestions - rejects question with fewer than 2 options", () => {
  assert.throws(
    () =>
      validateSubmitQuestions([
        {
          question: "Câu hỏi 1?",
          options: ["Duy nhất một phương án"],
          answer: "Duy nhất một phương án"
        }
      ]),
    (err) => err.message.includes("từ 2 đến 8")
  );
});

test("validateSubmitQuestions - rejects question with duplicate options", () => {
  assert.throws(
    () =>
      validateSubmitQuestions([
        {
          question: "Câu hỏi trùng phương án?",
          options: ["Phương án A", "Phương án A", "Phương án B"],
          answer: "Phương án A"
        }
      ]),
    (err) => err.message.includes("không được trùng lặp")
  );
});

test("validateSubmitQuestions - rejects question when answer is missing or not in options", () => {
  // Empty answer
  assert.throws(
    () =>
      validateSubmitQuestions([
        {
          question: "Câu hỏi?",
          options: ["A", "B"],
          answer: ""
        }
      ]),
    (err) => err.message.includes("Chưa chọn đáp án")
  );

  // Mismatched answer
  assert.throws(
    () =>
      validateSubmitQuestions([
        {
          question: "Câu hỏi?",
          options: ["A", "B"],
          answer: "C"
        }
      ]),
    (err) => err.message.includes("phải khớp chính xác")
  );
});

test("validateSubmitQuestions - strips unexpected unknown fields (no spread into model)", () => {
  const result = validateSubmitQuestions([
    {
      question: "Câu hỏi chuẩn?",
      options: ["A", "B"],
      answer: "A",
      explain: "Giải thích",
      maliciousField: "HACKED_DATA",
      role: "admin",
      status: "approved"
    }
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].question, "Câu hỏi chuẩn?");
  assert.deepEqual(result[0].options, ["A", "B"]);
  assert.equal(result[0].answer, "A");
  assert.equal(result[0].explain, "Giải thích");
  assert.equal(result[0].maliciousField, undefined);
  assert.equal(result[0].role, undefined);
  assert.equal(result[0].status, undefined);
});

// ==========================================
// 6. Subject & Chapter Suggestions validation
// ==========================================
test("validateSubjectAndChapter - Other subject requires suggestedSubject and suggestedChapter", async () => {
  // Missing suggestions
  await assert.rejects(
    async () => {
      await validateSubjectAndChapter({
        subjectId: "other",
        chapterId: null,
        suggestedSubject: "",
        suggestedChapter: ""
      });
    },
    (err) => err.message.includes("nhập tên môn học gợi ý")
  );

  // Provided suggestions format cleanly into adminNote
  const result = await validateSubjectAndChapter({
    subjectId: null,
    chapterId: null,
    suggestedSubject: "Môn Trí Tuệ Nhân Tạo",
    suggestedChapter: "Chương 1: Giới thiệu"
  });

  assert.equal(result.validSubjectId, null);
  assert.equal(result.validChapterId, null);
  assert.ok(result.formattedAdminNote.includes("[Gợi ý môn học]: Môn Trí Tuệ Nhân Tạo"));
  assert.ok(result.formattedAdminNote.includes("[Gợi ý chương]: Chương 1: Giới thiệu"));
});

test("validateSubjectAndChapter - Existing subject with other chapter requires suggestedChapter", async () => {
  const fakeSubjectId = new mongoose.Types.ObjectId();
  const originalFindById = Subject.findById;

  Subject.findById = async (id) => {
    if (String(id) === String(fakeSubjectId)) {
      return { _id: fakeSubjectId, name: "Toán", availability: true };
    }
    return null;
  };

  try {
    // Missing suggested chapter
    await assert.rejects(
      async () => {
        await validateSubjectAndChapter({
          subjectId: fakeSubjectId.toString(),
          chapterId: "other",
          suggestedChapter: ""
        });
      },
      (err) => err.message.includes("nhập tên chương gợi ý")
    );

    // Provided suggested chapter
    const result = await validateSubjectAndChapter({
      subjectId: fakeSubjectId.toString(),
      chapterId: "other",
      suggestedChapter: "Chương mới về Tích phân"
    });

    assert.equal(String(result.validSubjectId), String(fakeSubjectId));
    assert.equal(result.validChapterId, null);
    assert.ok(result.formattedAdminNote.includes("[Gợi ý chương]: Chương mới về Tích phân"));
  } finally {
    Subject.findById = originalFindById;
  }
});

test("validateSubjectAndChapter - Rejects chapter belonging to different subject", async () => {
  const subAId = new mongoose.Types.ObjectId();
  const subBId = new mongoose.Types.ObjectId();
  const chapId = new mongoose.Types.ObjectId();

  const originalSubFind = Subject.findById;
  const originalChapFind = Chapter.findById;

  Subject.findById = async (id) => ({
    _id: id,
    name: "Môn A",
    availability: true
  });

  Chapter.findById = async (id) => ({
    _id: id,
    subjectId: subBId, // Belongs to Subject B
    name: "Chương thuộc Môn B",
    availability: true
  });

  try {
    await assert.rejects(
      async () => {
        await validateSubjectAndChapter({
          subjectId: subAId.toString(),
          chapterId: chapId.toString()
        });
      },
      (err) => err.message.includes("không thuộc môn học đã chọn")
    );
  } finally {
    Subject.findById = originalSubFind;
    Chapter.findById = originalChapFind;
  }
});

// ==========================================
// 7. submitContribution endpoint tests
// ==========================================
test("submitContribution - Enforces weekly quota of 10 submissions in 7 days", async () => {
  const originalCount = ContributedQuiz.countDocuments;
  ContributedQuiz.countDocuments = async () => 10; // Already reached 10 submissions

  try {
    const { req, res } = createMockReqRes({
      user: { id: "user_reached_quota" },
      body: {
        name: "Đề mới",
        questions: [{ question: "Q1", options: ["A", "B"], answer: "A" }]
      }
    });

    await submitContribution(req, res);

    assert.equal(res.statusCode, 429);
    assert.match(res.data.message, /đạt giới hạn 10 đề/i);
  } finally {
    ContributedQuiz.countDocuments = originalCount;
  }
});

test("submitContribution - Successfully saves valid contribution with status 'pending'", async () => {
  const originalCount = ContributedQuiz.countDocuments;
  const originalCreate = ContributedQuiz.create;

  ContributedQuiz.countDocuments = async () => 2; // Only 2 contributions in last 7 days

  let createdDoc = null;
  ContributedQuiz.create = async (doc) => {
    createdDoc = { ...doc, _id: "quiz_new_id_123" };
    return createdDoc;
  };

  try {
    const { req, res } = createMockReqRes({
      user: { id: "user_valid_submit" },
      body: {
        name: "Đề thi thử Lịch Sử 12",
        subjectId: null,
        suggestedSubject: "Lịch Sử",
        suggestedChapter: "Cách mạng tháng Tám",
        timeLimit: 45,
        questions: [
          {
            question: "Cách mạng tháng Tám diễn ra vào năm nào?",
            options: ["1945", "1954", "1975", "1930"],
            answer: "1945",
            explain: "Diễn ra vào tháng 8 năm 1945"
          }
        ]
      }
    });

    await submitContribution(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.data.status, "pending");
    assert.ok(createdDoc);
    assert.equal(createdDoc.status, "pending");
    assert.equal(createdDoc.name, "Đề thi thử Lịch Sử 12");
    assert.equal(createdDoc.timeLimit, 45);
    assert.equal(createdDoc.questionNum, 1);
    assert.ok(createdDoc.adminNote.includes("[Gợi ý môn học]: Lịch Sử"));
    assert.ok(createdDoc.adminNote.includes("[Gợi ý chương]: Cách mạng tháng Tám"));
  } finally {
    ContributedQuiz.countDocuments = originalCount;
    ContributedQuiz.create = originalCreate;
  }
});
