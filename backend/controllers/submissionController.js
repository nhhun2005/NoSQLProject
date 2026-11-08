// ========================================================================
// backend/controllers/submissionController.js
// Mục đích: Quản lý toàn bộ bài nộp (Submission) của người dùng
// ========================================================================

import mongoose from "mongoose";
import Submission from "../models/submission.js";
import Quiz from "../models/quiz.js";
import { getAttempt, claimAttempt, releaseClaim, setAttemptResult } from "../utils/attemptStore.js";

// ========================================================================
// 1) Thêm hoặc cập nhật bài nộp
//    - Yêu cầu { quizId, attemptId, answers }
//    - Chỉ scored attempt mới được lưu
//    - Server tự chấm điểm dựa trên snapshot câu hỏi server-side
//    - Claim attempt đồng bộ trước khi await để chặn concurrent double writes
//    - Lưu kết quả thành công vào attempt để lặp lại idempotent
//    - Cho phép thử lại nếu lưu DB thất bại
//    - bestScore bảo toàn bằng atomic $max
//    - Ghi nhận hạn chế: Schema hiện tại chưa có unique compound index
//      cho { userId, quizId }, nên về mặt lý thuyết hai truy vấn tạo mới
//      song song trước khi có bản ghi có thể tạo bản ghi trùng lặp.
// ========================================================================
export const addSubmission = async (req, res) => {
  let claimedAttemptId;
  try {
    const {
      userId: bodyUserId,
      quizId,
      attemptId,
      answers
    } = req.body || {};

    // Reject mismatch if client attempts to spoof userId
    if (bodyUserId && String(bodyUserId) !== String(req.user.id)) {
      return res.status(403).json({
        message: "Không thể nộp bài thay cho người dùng khác"
      });
    }
    const userId = req.user.id;
    if (typeof quizId !== "string" || !/^[0-9a-fA-F]{24}$/.test(quizId) || typeof attemptId !== "string" || !Array.isArray(answers)) {
      return res.status(400).json({
        message: "Thiếu thông tin bắt buộc: quizId, attemptId và danh sách answers"
      });
    }
    const attempt = getAttempt(attemptId);
    if (!attempt) {
      return res.status(410).json({
        message: "Lượt làm bài không tồn tại hoặc đã hết hạn"
      });
    }

    // Check ownership of attempt
    if (String(attempt.userId) !== String(userId)) {
      return res.status(403).json({
        message: "Lượt làm bài không thuộc về bạn"
      });
    }

    // Check quizId match
    if (String(attempt.quizId) !== String(quizId)) {
      return res.status(400).json({
        message: "Quiz ID không khớp với lượt làm bài"
      });
    }

    // Check if idempotent result is already cached
    if (attempt.result) {
      return res.status(attempt.result.statusCode).json(attempt.result.body);
    }

    // Only scored attempts can persist to DB
    if (!attempt.scoreMode) {
      return res.status(400).json({
        message: "Lượt làm bài luyện tập không lưu kết quả vào hệ thống"
      });
    }

    // Check expiration (with grace period already incorporated in expiresAt)
    if (Date.now() > new Date(attempt.expiresAt).getTime()) {
      return res.status(410).json({
        message: "Thời gian làm bài đã kết thúc"
      });
    }

    // Synchronously claim attempt before any await to prevent race conditions / double writes
    const claimed = claimAttempt(attemptId, userId);
    if (!claimed) {
      if (attempt.result) {
        return res.status(attempt.result.statusCode).json(attempt.result.body);
      }
      return res.status(409).json({
        message: "Bài thi đang được xử lý, vui lòng không gửi lại"
      });
    }
    claimedAttemptId = attemptId;

    // Validate answers count, IDs, duplicates, and options
    const snapshotQuestions = attempt.questions;
    if (answers.length > snapshotQuestions.length) {
      releaseClaim(attemptId);
      return res.status(400).json({
        message: "Số lượng câu trả lời vượt quá số lượng câu hỏi trong đề"
      });
    }
    const validQuestionMap = new Map(snapshotQuestions.map(q => [String(q._id), q]));
    const seenQuestionIds = new Set();
    for (const ans of answers) {
      if (!ans || typeof ans !== "object" || !ans.questionId) {
        releaseClaim(attemptId);
        return res.status(400).json({
          message: "Cấu trúc câu trả lời không hợp lệ"
        });
      }
      const qId = String(ans.questionId);
      if (seenQuestionIds.has(qId)) {
        releaseClaim(attemptId);
        return res.status(400).json({
          message: `Trùng lặp câu trả lời cho câu hỏi: ${qId}`
        });
      }
      seenQuestionIds.add(qId);
      const questionObj = validQuestionMap.get(qId);
      if (!questionObj) {
        releaseClaim(attemptId);
        return res.status(400).json({
          message: `Câu hỏi ${qId} không thuộc bài thi này`
        });
      }
      if (ans.selectedOption !== undefined && ans.selectedOption !== null && ans.selectedOption !== "") {
        if (typeof ans.selectedOption !== "string" || !questionObj.options.includes(ans.selectedOption)) {
          releaseClaim(attemptId);
          return res.status(400).json({
            message: `Lựa chọn "${ans.selectedOption}" không hợp lệ cho câu hỏi ${qId}`
          });
        }
      }
    }

    // Server-side grading against server snapshot
    // Missing answers count as incorrect. Persist only answered entries because the
    // existing schema requires a non-empty selectedOption (no schema change).
    const clientAnswersMap = new Map(answers.map(a => [String(a.questionId), a.selectedOption]));
    let correctCount = 0;
    const totalQuestions = snapshotQuestions.length;
    const normalizedAnswers = snapshotQuestions.map(q => {
      const selected = clientAnswersMap.get(String(q._id)) || "";
      const isCorrect = Boolean(selected && selected === q.answer);
      if (isCorrect) correctCount++;
      return {
        questionId: String(q._id),
        selectedOption: selected,
        isCorrect
      };
    }).filter(answer => answer.selectedOption !== "");
    const score = totalQuestions > 0 ? Math.round(correctCount / totalQuestions * 100) : 0;

    // Server-derived elapsed time
    const timeSpent = Math.max(0, Math.floor((Date.now() - new Date(attempt.startTime).getTime()) / 1000));

    // Persist with atomic $max on bestScore using existing schema
    try {
      const submission = await Submission.findOneAndUpdate({
        userId,
        quizId
      }, {
        $set: {
          answers: normalizedAnswers,
          totalQuestions,
          score,
          timeSpent
        },
        $setOnInsert: {
          userId,
          quizId
        },
        $max: {
          bestScore: score
        }
      }, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: false,
        runValidators: true
      });
      const responseBody = {
        message: "Nộp bài thành công",
        submission
      };
      setAttemptResult(attemptId, {
        statusCode: 200,
        body: responseBody
      });
      return res.status(200).json(responseBody);
    } catch (_dbError) {
      // Allow retry after persistence failure
      releaseClaim(attemptId);
      return res.status(500).json({
        message: "Lỗi khi lưu kết quả bài thi vào cơ sở dữ liệu"
      });
    }
  } catch {
    if (claimedAttemptId && !getAttempt(claimedAttemptId)?.result) releaseClaim(claimedAttemptId);
    return res.status(500).json({
      message: "Lỗi server khi nộp bài"
    });
  }
};

// ========================================================================
// 2) Lấy bài làm gần nhất của user cho 1 quiz
// ========================================================================
export const getLatestSubmission = async (req, res) => {
  try {
    const {
      quizId,
      userId
    } = req.params;
    if (!quizId || !userId) {
      return res.status(400).json({
        message: "Thiếu quizId hoặc userId."
      });
    }
    if (!/^[0-9a-fA-F]{24}$/.test(quizId) || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      return res.status(400).json({
        message: "quizId hoặc userId không hợp lệ."
      });
    }
    if (req.user.role !== "Admin" && String(req.user.id) !== String(userId)) {
      return res.status(403).json({
        message: "Không có quyền xem bài làm của người khác"
      });
    }
    const latest = await Submission.findOne({
      quizId: new mongoose.Types.ObjectId(quizId),
      userId: new mongoose.Types.ObjectId(userId)
    }).sort({
      updatedAt: -1
    }).lean();
    if (!latest) return res.status(200).json(null);
    return res.status(200).json(latest);
  } catch (_error) {
    return res.status(500).json({
      message: "Không thể lấy bài làm gần nhất."
    });
  }
};

// ========================================================================
// 3) Lấy toàn bộ submission của 1 user
// ========================================================================
export const getUserSubmissions = async (req, res) => {
  try {
    const {
      userId
    } = req.params;
    if (req.user.role !== "Admin" && String(req.user.id) !== String(userId)) {
      return res.status(403).json({
        message: "Không có quyền xem bài làm của người khác"
      });
    }
    const submissions = await Submission.find({
      userId
    }).populate("quizId").sort({
      updatedAt: -1
    });
    return res.status(200).json(submissions);
  } catch (_error) {
    return res.status(500).json({
      message: "Không thể lấy bài nộp của người dùng."
    });
  }
};

// ========================================================================
// 4) Lấy toàn bộ submission theo môn học
//    - Derives quiz IDs from Quiz.find({ subjectId })
//    - Submission.find({ userId, quizId: { $in: ids } }).populate('quizId')
//    - No nonexistent subjectId or chapterId fields queried on Submission
// ========================================================================
export const getAllSubmissionFromSubject = async (req, res) => {
  const {
    userId,
    subjectId
  } = req.params;
  if (req.user.role !== "Admin" && String(req.user.id) !== String(userId)) {
    return res.status(403).json({
      message: "Không có quyền xem bài làm của người khác"
    });
  }
  try {
    const quizzes = await Quiz.find({
      subjectId
    }).select("_id");
    const quizIds = quizzes.map(q => q._id);
    const submissions = await Submission.find({
      userId,
      quizId: {
        $in: quizIds
      }
    }).populate("quizId");
    return res.status(200).json(submissions);
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi lấy submissions theo môn"
    });
  }
};

// ========================================================================
// 5) Lấy bài nộp có điểm cao nhất
// ========================================================================
export const getBestSubmission = async (req, res) => {
  try {
    const {
      quizId,
      userId
    } = req.params;
    if (!quizId || !userId) return res.status(400).json({
      message: "Thiếu quizId hoặc userId"
    });
    if (!/^[0-9a-fA-F]{24}$/.test(quizId) || !/^[0-9a-fA-F]{24}$/.test(userId)) {
      return res.status(400).json({
        message: "quizId hoặc userId không hợp lệ"
      });
    }
    if (req.user.role !== "Admin" && String(req.user.id) !== String(userId)) {
      return res.status(403).json({
        message: "Không có quyền xem bài làm của người khác"
      });
    }
    const bestSubmission = await Submission.findOne({
      quizId: new mongoose.Types.ObjectId(quizId),
      userId: new mongoose.Types.ObjectId(userId)
    }).sort({
      bestScore: -1
    }).lean();
    return res.status(200).json(bestSubmission || null);
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi lấy best submission"
    });
  }
};
