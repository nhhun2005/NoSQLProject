import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseContributionCSV } from "../utils/contributionCsv.js";
import { handleCSVUpload } from "../controllers/contributeController.js";
import ContributedQuiz from "../models/contributedQuiz.js";
import { createMockReqRes } from "./helpers.js";

// Helper to create a temporary test directory
function createTestDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "contrib-csv-test-"));
}

test("parseContributionCSV - plain UTF-8 with standard unquoted headers", async () => {
  const testDir = createTestDir();
  const filePath = path.join(testDir, "plain_unquoted.csv");
  try {
    const csvContent = "question,options,answer,explain\n" +
      "What is Node.js?,Runtime;Framework;Language,Runtime,JS runtime\n" +
      "Is JavaScript single-threaded?,Yes;No,Yes,Event loop handles concurrency\n";
    fs.writeFileSync(filePath, csvContent, "utf8");

    const rows = await parseContributionCSV(filePath);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].question, "What is Node.js?");
    assert.equal(rows[0].options, "Runtime;Framework;Language");
    assert.equal(rows[0].answer, "Runtime");
    assert.equal(rows[0].explain, "JS runtime");
    assert.equal(rows[1].question, "Is JavaScript single-threaded?");
    assert.equal(rows[1].answer, "Yes");
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test("parseContributionCSV - plain UTF-8 with quoted headers", async () => {
  const testDir = createTestDir();
  const filePath = path.join(testDir, "plain_quoted.csv");
  try {
    const csvContent = '"question","options","answer","explain"\n' +
      '"Question 1","Opt A;Opt B","Opt A","Explain 1"\n';
    fs.writeFileSync(filePath, csvContent, "utf8");

    const rows = await parseContributionCSV(filePath);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].question, "Question 1");
    assert.equal(rows[0].options, "Opt A;Opt B");
    assert.equal(rows[0].answer, "Opt A");
    assert.equal(rows[0].explain, "Explain 1");
    assert.equal(rows[0]['"question"'], undefined);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test("parseContributionCSV - UTF-8 BOM with quoted headers (fixes the 14 rows discarded bug)", async () => {
  const testDir = createTestDir();
  const filePath = path.join(testDir, "bom_quoted_14_rows.csv");
  try {
    // Generate exactly 14 rows with UTF-8 BOM and quoted headers
    let csvContent = '\uFEFF"question","options","answer","explain"\n';
    for (let i = 1; i <= 14; i++) {
      csvContent += `"Câu hỏi số ${i}: Nội dung câu hỏi?","Đáp án A;Đáp án B;Đáp án C;Đáp án D","Đáp án A","Giải thích cho câu ${i}"\n`;
    }
    fs.writeFileSync(filePath, csvContent, "utf8");

    const rows = await parseContributionCSV(filePath);
    assert.equal(rows.length, 14, "All 14 rows must be parsed");

    for (let i = 0; i < 14; i++) {
      const row = rows[i];
      assert.ok(row.question, `Row ${i + 1} must have question property`);
      assert.equal(row.question, `Câu hỏi số ${i + 1}: Nội dung câu hỏi?`);
      assert.equal(row.options, "Đáp án A;Đáp án B;Đáp án C;Đáp án D");
      assert.equal(row.answer, "Đáp án A");
      assert.equal(row.explain, `Giải thích cho câu ${i + 1}`);
      assert.equal(row['"question"'], undefined, "Must not have literal quoted key");
      assert.equal(row['\ufeffquestion'], undefined, "Must not have BOM in key");
      assert.equal(row['\ufeff"question"'], undefined, "Must not have BOM+quote in key");
    }
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test("parseContributionCSV - UTF-8 BOM with unquoted headers", async () => {
  const testDir = createTestDir();
  const filePath = path.join(testDir, "bom_unquoted.csv");
  try {
    const csvContent = '\uFEFFquestion,options,answer,explain\n' +
      'Q1,A;B,A,E1\n';
    fs.writeFileSync(filePath, csvContent, "utf8");

    const rows = await parseContributionCSV(filePath);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].question, "Q1");
    assert.equal(rows[0].options, "A;B");
    assert.equal(rows[0].answer, "A");
    assert.equal(rows[0].explain, "E1");
    assert.equal(rows[0]['\ufeffquestion'], undefined);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test("parseContributionCSV - CRLF line endings with BOM and quotes", async () => {
  const testDir = createTestDir();
  const filePath = path.join(testDir, "crlf_bom.csv");
  try {
    const csvContent = '\uFEFF"question","options","answer","explain"\r\n' +
      '"CRLF Q1","Opt 1;Opt 2","Opt 1","Exp 1"\r\n' +
      '"CRLF Q2","Opt 3;Opt 4","Opt 3","Exp 2"\r\n';
    fs.writeFileSync(filePath, csvContent, "utf8");

    const rows = await parseContributionCSV(filePath);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].question, "CRLF Q1");
    assert.equal(rows[0].explain, "Exp 1");
    assert.equal(rows[1].question, "CRLF Q2");
    assert.equal(rows[1].explain, "Exp 2");
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test("parseContributionCSV - embedded commas, newlines, and escaped quotes with zero regression of content", async () => {
  const testDir = createTestDir();
  const filePath = path.join(testDir, "complex_escaping.csv");
  try {
    const complexQuestion = 'Câu hỏi: Đoạn mã sau có lỗi gì?\nif (x, y) {\n  return "ok";\n}';
    const complexOptions = 'Lỗi dấu phẩy, cú pháp;Không có lỗi;Lỗi khác, xem thêm';
    const complexAnswer = 'Lỗi dấu phẩy, cú pháp';
    const complexExplain = 'Giải thích: Trong JavaScript, toán tử dấu phẩy (comma operator) đánh giá cả 2 vế và trả về vế cuối cùng.\nTham khảo thêm tài liệu "MDN".';

    const csvContent = '\uFEFF"question","options","answer","explain"\r\n' +
      `"${complexQuestion.replace(/"/g, '""')}","${complexOptions.replace(/"/g, '""')}","${complexAnswer.replace(/"/g, '""')}","${complexExplain.replace(/"/g, '""')}"\r\n`;

    fs.writeFileSync(filePath, csvContent, "utf8");

    const rows = await parseContributionCSV(filePath);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].question, complexQuestion);
    assert.equal(rows[0].options, complexOptions);
    assert.equal(rows[0].answer, complexAnswer);
    assert.equal(rows[0].explain, complexExplain);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test("parseContributionCSV - edge cases: empty file, BOM only, headers only", async () => {
  const testDir = createTestDir();
  try {
    const emptyFile = path.join(testDir, "empty.csv");
    fs.writeFileSync(emptyFile, "", "utf8");
    const emptyRows = await parseContributionCSV(emptyFile);
    assert.deepEqual(emptyRows, []);

    const bomOnlyFile = path.join(testDir, "bom_only.csv");
    fs.writeFileSync(bomOnlyFile, "\uFEFF", "utf8");
    const bomOnlyRows = await parseContributionCSV(bomOnlyFile);
    assert.deepEqual(bomOnlyRows, []);

    const headerOnlyFile = path.join(testDir, "header_only.csv");
    fs.writeFileSync(headerOnlyFile, "question,options,answer,explain\n", "utf8");
    const headerOnlyRows = await parseContributionCSV(headerOnlyFile);
    assert.deepEqual(headerOnlyRows, []);

    const bomHeaderOnlyFile = path.join(testDir, "bom_header_only.csv");
    fs.writeFileSync(bomHeaderOnlyFile, '\uFEFF"question","options","answer","explain"\r\n', "utf8");
    const bomHeaderOnlyRows = await parseContributionCSV(bomHeaderOnlyFile);
    assert.deepEqual(bomHeaderOnlyRows, []);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test("parseContributionCSV - error handling for non-existent file or directory path", async () => {
  const testDir = createTestDir();
  try {
    const nonExistentPath = path.join(testDir, "not_found.csv");
    await assert.rejects(
      async () => {
        await parseContributionCSV(nonExistentPath);
      },
      (err) => {
        assert.equal(err.code, "ENOENT");
        return true;
      }
    );

    // Passing a directory path instead of a file should also reject
    await assert.rejects(
      async () => {
        await parseContributionCSV(testDir);
      },
      (err) => {
        assert.ok(err.code === "EISDIR" || err.message.includes("EISDIR"));
        return true;
      }
    );
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test("handleCSVUpload controller - 400 when req.file is missing", async () => {
  const { req, res } = createMockReqRes({ user: { id: "user123" } });
  delete req.file;

  await handleCSVUpload(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.data.message, "Chưa tải lên file CSV nào!");
});

test("handleCSVUpload controller - 400 and temp file cleanup on parse failure", async () => {
  const testDir = createTestDir();
  const filePath = path.join(testDir, "corrupted.csv");
  try {
    // Passing a non-existent path in req.file.path simulates read/parse failure
    const nonExistent = path.join(testDir, "missing.csv");
    const { req, res } = createMockReqRes({ user: { id: "user123" } });
    req.file = { path: nonExistent };

    await handleCSVUpload(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.data.message, "Lỗi khi đọc file CSV! Vui lòng kiểm tra định dạng file.");

    // Also test with actual file that becomes unreadable / directory
    const { req: req2, res: res2 } = createMockReqRes({ user: { id: "user123" } });
    // Write a file, then mock or trigger parse failure
    fs.writeFileSync(filePath, "test", "utf8");
    req2.file = { path: testDir }; // directory causes EISDIR in stream

    await handleCSVUpload(req2, res2);
    assert.equal(res2.statusCode, 400);
    assert.equal(res2.data.message, "Lỗi khi đọc file CSV! Vui lòng kiểm tra định dạng file.");
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test("handleCSVUpload controller - 400 and temp file cleanup when questions.length === 0 (empty file / headers only)", async () => {
  const testDir = createTestDir();
  const filePath = path.join(testDir, "empty_headers.csv");
  try {
    fs.writeFileSync(filePath, '\uFEFF"question","options","answer","explain"\r\n', "utf8");
    assert.ok(fs.existsSync(filePath), "Temp file must exist before upload");

    const { req, res } = createMockReqRes({ user: { id: "user123" } });
    req.file = { path: filePath };

    await handleCSVUpload(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.data.message, "File CSV không chứa câu hỏi hợp lệ!");
    assert.ok(!fs.existsSync(filePath), "Temp file must be unlinked / cleaned up");
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test("handleCSVUpload controller - 400 and temp file cleanup when all rows are invalid", async () => {
  const testDir = createTestDir();
  const filePath = path.join(testDir, "invalid_rows.csv");
  try {
    // Missing answer and options in rows
    const content = "question,options,answer\n" +
      "Just question without options or answer,,\n" +
      ",Opt A;Opt B,\n";
    fs.writeFileSync(filePath, content, "utf8");
    assert.ok(fs.existsSync(filePath));

    const { req, res } = createMockReqRes({ user: { id: "user123" } });
    req.file = { path: filePath };

    await handleCSVUpload(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.data.message, /Câu hỏi số 1/);
    assert.ok(!fs.existsSync(filePath), "Temp file must be removed");
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test("handleCSVUpload controller - successfully saves 14 rows with UTF-8 BOM and quoted headers", async (t) => {
  const testDir = createTestDir();
  const filePath = path.join(testDir, "valid_14_rows.csv");
  try {
    let csvContent = '\uFEFF"question","options","answer","explain"\r\n';
    for (let i = 1; i <= 14; i++) {
      csvContent += `"Câu hỏi ${i}: NoSQL là gì?","Cơ sở dữ liệu phi quan hệ;Ngôn ngữ lập trình;Hệ điều hành","Cơ sở dữ liệu phi quan hệ","NoSQL viết tắt Not Only SQL"\r\n`;
    }
    fs.writeFileSync(filePath, csvContent, "utf8");

    let createdData = null;
    let countCalled = 0;

    // Mock ContributedQuiz methods without touching real database
    t.mock.method(ContributedQuiz, "countDocuments", async () => {
      countCalled++;
      return 2; // under limit
    });
    t.mock.method(ContributedQuiz, "create", async (data) => {
      createdData = data;
      return { _id: "new-quiz-id", ...data };
    });

    const { req, res } = createMockReqRes({
      user: { id: "user_contributor_1" },
      body: {
        name: "Đề kiểm tra NoSQL",
        subjectId: "507f1f77bcf86cd799439011",
        chapterId: "507f1f77bcf86cd799439012",
        timeLimit: 60
      }
    });
    req.file = { path: filePath };

    await handleCSVUpload(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.data.message, "✅ Upload CSV thành công!");
    assert.equal(countCalled, 1);
    assert.ok(createdData, "ContributedQuiz.create must have been called");
    assert.equal(createdData.questionNum, 14, "All 14 rows must be present");
    assert.equal(createdData.questions.length, 14);
    assert.equal(createdData.name, "Đề kiểm tra NoSQL");
    assert.equal(createdData.timeLimit, 60);

    // Verify mapping of the first question
    const firstQ = createdData.questions[0];
    assert.equal(firstQ.question, "Câu hỏi 1: NoSQL là gì?");
    assert.deepEqual(firstQ.options, [
      "Cơ sở dữ liệu phi quan hệ",
      "Ngôn ngữ lập trình",
      "Hệ điều hành"
    ]);
    assert.equal(firstQ.answer, "Cơ sở dữ liệu phi quan hệ");
    assert.equal(firstQ.explain, "NoSQL viết tắt Not Only SQL");

    // Verify temp file is unlinked
    assert.ok(!fs.existsSync(filePath), "Temp file must be removed after successful creation");
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
