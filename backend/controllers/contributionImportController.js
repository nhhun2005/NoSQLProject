import path from "node:path";
import ContributedQuiz from "../models/contributedQuiz.js";
import { parseContributionCSVBuffer } from "../utils/contributionCsv.js";
import {
  acquireImportSlot,
  releaseImportSlot
} from "../utils/contributionImportLimits.js";
import {
  processPdfContribution,
  GeminiServiceError
} from "../services/geminiContribution.js";
import {
  validateContributionSubmission,
  getQuestionValidationErrors,
  ValidationError
} from "../utils/contributionValidation.js";

const WEEKLY_SUBMISSION_LIMIT = 10;
const MAX_QUESTIONS_IMPORT = 200;

/**
 * Strips file extension and returns a clean quiz title.
 */
function titleFromFileName(filename = "") {
  const base = path.basename(filename, path.extname(filename)).trim();
  return base || "Đề đóng góp mới";
}

/**
 * Handles CSV buffer parsing and prepares preview questions and warnings.
 */
function buildCsvPreview(rows, defaultTitle) {
  const questions = [];
  const warnings = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const indexStr = `Dòng ${i + 1}`;

    const qRaw = r.question ? String(r.question).replace(/^"|"$/g, "").trim() : "";
    const optRaw = r.options ? String(r.options).replace(/^"|"$/g, "").trim() : "";
    const options = optRaw
      ? optRaw.split(";").map((o) => o.trim())
      : [];

    let ans = r.answer ? String(r.answer).replace(/^"|"$/g, "").trim() : "";
    if (ans) {
      if (!options.includes(ans)) {
        const caseMatches = options.filter(
          (o) => o.toLowerCase() === ans.toLowerCase()
        );
        if (caseMatches.length === 1) {
          ans = caseMatches[0];
        }
      }
    }

    const explain = r.explain ? String(r.explain).replace(/^"|"$/g, "").trim() : "";

    const questionObj = {
      question: qRaw,
      options,
      answer: ans,
      explain
    };

    const rowErrors = getQuestionValidationErrors(questionObj, indexStr, {
      isPreview: true
    });
    warnings.push(...rowErrors);

    questions.push(questionObj);
  }

  if (questions.length === 0) {
    throw new ValidationError("File CSV không chứa câu hỏi hợp lệ!", 400);
  }

  if (questions.length > MAX_QUESTIONS_IMPORT) {
    throw new ValidationError(
      `File CSV chứa ${questions.length} câu hỏi, vượt quá giới hạn tối đa ${MAX_QUESTIONS_IMPORT} câu!`,
      400
    );
  }

  return {
    name: defaultTitle,
    questions,
    warnings
  };
}

/**
 * POST /api/contributed/import
 * In-memory preview extraction for PDF or CSV.
 * ABSOLUTELY NO DATABASE WRITES.
 */
export const importContributionPreview = async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  if (!userId) {
    return res.status(401).json({ message: "Vui lòng đăng nhập trước khi tải file!" });
  }

  // Acquire concurrency & cooldown slot
  const slot = acquireImportSlot(String(userId));
  if (!slot.allowed) {
    return res.status(slot.status || 429).json({ message: slot.message });
  }

  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "Vui lòng chọn file để tải lên!" });
    }

    const ext = path.extname(req.file.originalname || "").toLowerCase();
    const fallbackTitle = titleFromFileName(req.file.originalname);

    if (ext === ".csv") {
      let rows;
      try {
        rows = await parseContributionCSVBuffer(req.file.buffer);
      } catch (_err) {
        return res.status(400).json({
          message: "Lỗi khi đọc file CSV! Vui lòng kiểm tra định dạng và mã hóa UTF-8."
        });
      }

      const previewData = buildCsvPreview(rows, fallbackTitle);
      return res.json(previewData);
    }

    if (ext === ".pdf") {
      const previewData = await processPdfContribution(req.file.buffer);
      if (!previewData.name) {
        previewData.name = fallbackTitle;
      }
      return res.json(previewData);
    }

    return res.status(400).json({
      message: "Chỉ chấp nhận file định dạng .pdf hoặc .csv!"
    });
  } catch (err) {
    if (err instanceof GeminiServiceError || err instanceof ValidationError) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error("Contribution import error:", err.message);
    return res.status(500).json({
      message: "Lỗi máy chủ khi xử lý tài liệu. Vui lòng thử lại sau!"
    });
  } finally {
    releaseImportSlot(String(userId));
  }
};

/**
 * POST /api/contributed/submit
 * Submits finalized and validated contribution quiz to the database with status: "pending".
 */
export const submitContribution = async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  if (!userId) {
    return res.status(401).json({ message: "Bạn cần đăng nhập để gửi đề đóng góp!" });
  }

  try {
    // 1. Weekly quota check (10 contributions per 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentCount = await ContributedQuiz.countDocuments({
      contributorId: userId,
      createdAt: { $gte: oneWeekAgo }
    });

    if (recentCount >= WEEKLY_SUBMISSION_LIMIT) {
      return res.status(429).json({
        message: `🚫 Bạn đã đạt giới hạn ${WEEKLY_SUBMISSION_LIMIT} đề đóng góp trong 7 ngày gần nhất. Hãy thử lại sau!`
      });
    }

    // 2. Strict validation of questions, suggestions, subject & chapter
    const sanitized = await validateContributionSubmission(req.body);

    // 3. Save to database with status "pending"
    const quiz = await ContributedQuiz.create({
      contributorId: userId,
      name: sanitized.name,
      subjectId: sanitized.subjectId,
      chapterId: sanitized.chapterId,
      questionNum: sanitized.questions.length,
      timeLimit: sanitized.timeLimit,
      questions: sanitized.questions,
      adminNote: sanitized.adminNote,
      status: "pending"
    });

    return res.status(201).json({
      message: "✅ Gửi đề đóng góp thành công! Đề đang chờ quản trị viên phê duyệt.",
      quizId: quiz._id,
      status: quiz.status
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error("Contribution submit error:", err);
    return res.status(500).json({
      message: "Lỗi hệ thống khi lưu đề đóng góp. Vui lòng thử lại sau!"
    });
  }
};
