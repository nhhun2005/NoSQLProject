// 📁 controllers/quizController.js
import Quiz from "../models/quiz.js";
import Question from "../models/questionText.js";
import QuestionIMG from "../models/questionImage.js";
import Subject from "../models/subject.js";
import Chapter from "../models/chapter.js";
import Submission from "../models/submission.js";
import { createAttempt } from "../utils/attemptStore.js";

/**
 * Helper to check whether a quiz and its parent subject/chapter are available for normal users.
 */
const checkQuizVisibility = async (quiz, userRole) => {
  if (userRole === "Admin") return true;
  if (quiz.availability === false) {
    return false;
  }
  if (quiz.subjectId) {
    const subject = await Subject.findById(quiz.subjectId);
    if (!subject || subject.availability === false) {
      return false;
    }
  }
  if (quiz.chapterId) {
    const chapter = await Chapter.findById(quiz.chapterId);
    if (!chapter || chapter.availability === false) {
      return false;
    }
  }
  return true;
};

// 🟩 Thêm quiz mới
export const addQuiz = async (req, res) => {
  try {
    const {
      name,
      subjectId,
      chapterId,
      questionNum,
      availability,
      timeLimit,
      note
    } = req.body || {};
    const newQuiz = new Quiz({
      name,
      subjectId,
      questionNum: questionNum || 0,
      chapterId,
      availability: availability !== undefined ? availability : true,
      timeLimit: timeLimit || 0,
      note: note || ""
    });
    await newQuiz.save();
    return res.status(201).json(newQuiz);
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi thêm quiz"
    });
  }
};

// 🟩 Cập nhật quiz (bao gồm cả câu hỏi)
export const updateQuizFull = async (req, res) => {
  try {
    const {
      name,
      questions,
      timeLimit,
      chapterId
    } = req.body || {};
    const quizId = req.params.id;
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        message: "Không tìm thấy quiz"
      });
    }
    if (typeof name !== "string" || !name.trim() || name.trim().length > 300) return res.status(400).json({
      message: "Tên bộ đề phải có từ 1 đến 300 ký tự"
    });

    // 1. Validate chapter if provided
    if (chapterId) {
      const chapter = await Chapter.findById(chapterId);
      if (!chapter) {
        return res.status(400).json({
          message: "Chương không tồn tại"
        });
      }
      if (quiz.subjectId && chapter.subjectId && String(chapter.subjectId) !== String(quiz.subjectId)) {
        return res.status(400).json({
          message: "Chương không thuộc cùng môn học với bài thi"
        });
      }
    }

    // 2. Validate timeLimit if provided
    if (timeLimit !== undefined) {
      if (typeof timeLimit !== "number" || !Number.isFinite(timeLimit) || timeLimit < 0) {
        return res.status(400).json({
          message: "Thời gian làm bài không hợp lệ"
        });
      }
    }

    // 3. Validate questions payload
    if (!Array.isArray(questions)) {
      return res.status(400).json({
        message: "Danh sách câu hỏi (questions) phải là một mảng"
      });
    }

    // Check unique question IDs in payload
    const payloadIds = new Set();
    for (const q of questions) {
      if (!q || typeof q !== "object" || Array.isArray(q)) return res.status(400).json({
        message: "Dữ liệu câu hỏi không hợp lệ"
      });
      if (q._id) {
        const idStr = String(q._id);
        if (!/^[0-9a-fA-F]{24}$/.test(idStr)) return res.status(400).json({
          message: "ID câu hỏi không hợp lệ"
        });
        if (payloadIds.has(idStr)) {
          return res.status(400).json({
            message: `Trùng lặp ID câu hỏi trong dữ liệu gửi lên: ${idStr}`
          });
        }
        payloadIds.add(idStr);
      }
    }

    // Validate options and answer consistency for all questions
    for (const q of questions) {
      if (typeof q.question !== "string" || !q.question.trim()) {
        return res.status(400).json({
          message: "Nội dung câu hỏi không được để trống"
        });
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        return res.status(400).json({
          message: "Mỗi câu hỏi cần có ít nhất 2 đáp án lựa chọn"
        });
      }
      if (q.options.some(option => typeof option !== "string" || !option.trim()) || new Set(q.options.map(option => option.trim())).size !== q.options.length || q.image !== undefined && typeof q.image !== "string") return res.status(400).json({
        message: "Lựa chọn phải là chuỗi không trống, không trùng nhau; ảnh phải là chuỗi URL"
      });
      if (typeof q.answer !== "string" || !q.options.includes(q.answer)) {
        return res.status(400).json({
          message: `Đáp án đúng "${q.answer}" không nằm trong danh sách lựa chọn`
        });
      }
    }

    // Ownership check: any question with _id must already belong to this quiz
    const existingTextQuestions = await Question.find({
      quizId
    });
    const existingImgQuestions = await QuestionIMG.find({
      quizId
    });
    const existingTextMap = new Map(existingTextQuestions.map(q => [String(q._id), q]));
    const existingImgMap = new Map(existingImgQuestions.map(q => [String(q._id), q]));
    for (const q of questions) {
      if (q._id) {
        const idStr = String(q._id);
        if (!existingTextMap.has(idStr) && !existingImgMap.has(idStr)) {
          return res.status(400).json({
            message: `Câu hỏi với ID ${idStr} không thuộc quiz này`
          });
        }
      }
    }

    // 4. Perform question writes
    // Note: Standalone MongoDB without replica sets does not support multi-collection transactions.
    // Writes are sequenced carefully: validation is completed first; saves execute before destructive deletion.
    for (const q of questions) {
      const hasImage = Boolean(q.image && q.image.trim() !== "");
      const questionData = {
        question: q.question,
        options: q.options,
        answer: q.answer,
        explain: q.explain || "",
        quizId
      };
      if (q._id) {
        const idStr = String(q._id);
        const wasInText = existingTextMap.has(idStr);
        const wasInImg = existingImgMap.has(idStr);
        if (wasInText && hasImage) {
          // Convert text question to image question keeping same _id:
          // Create destination first, then remove from original collection
          await QuestionIMG.create({
            _id: q._id,
            ...questionData,
            image: q.image
          });
          await Question.findByIdAndDelete(q._id);
        } else if (wasInImg && !hasImage) {
          // Convert image question to text question keeping same _id:
          await Question.create({
            _id: q._id,
            ...questionData
          });
          await QuestionIMG.findByIdAndDelete(q._id);
        } else if (wasInText && !hasImage) {
          if (!(await Question.findByIdAndUpdate(q._id, questionData, {
            runValidators: true
          }))) throw new Error("Question changed during save");
        } else if (wasInImg && hasImage) {
          if (!(await QuestionIMG.findByIdAndUpdate(q._id, {
            ...questionData,
            image: q.image
          }, {
            runValidators: true
          }))) throw new Error("Question changed during save");
        }
      } else {
        // Create new question
        if (hasImage) {
          await QuestionIMG.create({
            ...questionData,
            image: q.image
          });
        } else {
          await Question.create(questionData);
        }
      }
    }

    // 5. Delete questions omitted from the complete questions array, scoped strictly to this quiz
    const omittedTextIds = Array.from(existingTextMap.keys()).filter(id => !payloadIds.has(id));
    const omittedImgIds = Array.from(existingImgMap.keys()).filter(id => !payloadIds.has(id));
    if (omittedTextIds.length > 0) {
      await Question.deleteMany({
        _id: {
          $in: omittedTextIds
        },
        quizId
      });
    }
    if (omittedImgIds.length > 0) {
      await QuestionIMG.deleteMany({
        _id: {
          $in: omittedImgIds
        },
        quizId
      });
    }

    // 6. Update quiz metadata and questionNum
    const updateFields = {
      questionNum: questions.length
    };
    if (name !== undefined) updateFields.name = name;
    if (chapterId !== undefined) updateFields.chapterId = chapterId;
    if (timeLimit !== undefined) updateFields.timeLimit = timeLimit;
    const updatedQuiz = await Quiz.findByIdAndUpdate(quizId, updateFields, {
      new: true,
      runValidators: true
    });
    if (!updatedQuiz) throw new Error("Quiz changed during save");
    return res.status(200).json({
      message: "✅ Cập nhật quiz và câu hỏi thành công",
      updatedQuiz
    });
  } catch (_error) {
    return res.status(500).json({
      message: "Lỗi trong quá trình cập nhật quiz",
      partialWrite: true
    });
  }
};

// 🟩 Cập nhật trạng thái availability
export const updateQuizAvailability = async (req, res) => {
  try {
    const {
      availability
    } = req.body || {};
    const quiz = await Quiz.findByIdAndUpdate(req.params.id, {
      availability: Boolean(availability)
    }, {
      new: true
    });
    if (!quiz) {
      return res.status(404).json({
        message: "Không tìm thấy quiz"
      });
    }
    return res.status(200).json({
      message: "Cập nhật thành công",
      updatedQuiz: quiz
    });
  } catch (_error) {
    return res.status(500).json({
      message: "Lỗi server khi cập nhật quiz"
    });
  }
};

// 🟩 Lấy tất cả quiz
export const getQuiz = async (req, res) => {
  try {
    const filter = {};
    if (req.user && req.user.role !== "Admin") {
      filter.availability = {
        $ne: false
      };
    }
    const quizzes = await Quiz.find(filter);
    return res.status(200).json(quizzes);
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi lấy danh sách quiz"
    });
  }
};

// 🟩 Lấy quiz theo chương
export const getQuizFromChapter = async (req, res) => {
  try {
    const filter = {
      chapterId: req.params.id
    };
    if (req.user && req.user.role !== "Admin") {
      filter.availability = {
        $ne: false
      };
    }
    const quizzes = await Quiz.find(filter);
    return res.status(200).json(quizzes);
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi lấy quiz theo chương"
    });
  }
};

// 🟩 Lấy quiz theo subject
export const getQuizBySubject = async (req, res) => {
  try {
    const filter = {
      subjectId: req.params.subjectid
    };
    if (req.user && req.user.role !== "Admin") {
      filter.availability = {
        $ne: false
      };
    }
    const quizzes = await Quiz.find(filter);
    return res.status(200).json(quizzes);
  } catch (_error) {
    return res.status(500).json({
      message: "Lỗi khi lấy quiz theo subject"
    });
  }
};

// 🟩 Xóa quiz
export const deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findByIdAndDelete(req.params.id);
    if (!quiz) {
      return res.status(404).json({
        message: "Not found quiz"
      });
    }
    // Also cleanup questions for this quiz

    return res.status(200).json({
      message: "Xóa quiz thành công",
      deletedQuiz: quiz
    });
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi server khi xóa quiz"
    });
  }
};

// 🟩 Lấy quiz theo ID:
// - Normal users receive metadata + questions WITHOUT answer / explain
// - Admin receives full questions data
// - Rejects hidden quiz/subject/chapter for normal users
export const getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({
        message: "Không tìm thấy quiz"
      });
    }
    const isVisible = await checkQuizVisibility(quiz, req.user?.role);
    if (!isVisible) {
      return res.status(403).json({
        message: "Bài thi hiện không khả dụng"
      });
    }
    const question = await Question.find({
      quizId: req.params.id
    });
    const questionImage = await QuestionIMG.find({
      quizId: req.params.id
    });
    const questions = [...question, ...questionImage];
    const safeQuestions = questions.map(q => {
      const qObj = typeof q.toObject === "function" ? q.toObject() : {
        ...q
      };
      if (req.user?.role !== "Admin") {
        delete qObj.answer;
        delete qObj.explain;
      }
      return qObj;
    });
    return res.status(200).json({
      ...quiz.toObject(),
      questions: safeQuestions
    });
  } catch (_error) {
    return res.status(500).json({
      message: "Lỗi khi lấy quiz"
    });
  }
};

// 🟩 GET /quizzes/:id/review:
// Returns full data for Admin or authenticated user who has a stored submission for this quiz;
// Normal users without submission return 403.
export const reviewQuiz = async (req, res) => {
  try {
    const quizId = req.params.id;
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        message: "Không tìm thấy quiz"
      });
    }
    if (req.user?.role !== "Admin") {
      const submission = await Submission.findOne({
        userId: req.user.id,
        quizId
      });
      if (!submission) {
        return res.status(403).json({
          message: "Bạn chưa hoàn thành bài thi này để xem lại"
        });
      }
    }
    const question = await Question.find({
      quizId
    });
    const questionImage = await QuestionIMG.find({
      quizId
    });
    const questions = [...question, ...questionImage];
    return res.status(200).json({
      ...quiz.toObject(),
      questions
    });
  } catch (_error) {
    return res.status(500).json({
      message: "Lỗi khi tải dữ liệu xem lại quiz"
    });
  }
};

// 🟩 POST /quizzes/:id/attempt:
// In-memory bounded TTL attempt (no DB write)
export const createQuizAttempt = async (req, res) => {
  try {
    const quizId = req.params.id;
    const {
      scoreMode
    } = req.body || {};
    if (typeof scoreMode !== "boolean") return res.status(400).json({
      message: "scoreMode phải là boolean"
    });
    const isScoreMode = scoreMode;
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        message: "Không tìm thấy quiz"
      });
    }
    const isVisible = await checkQuizVisibility(quiz, req.user?.role);
    if (!isVisible) {
      return res.status(403).json({
        message: "Bài thi hiện không khả dụng"
      });
    }

    // Scored attempt requires positive finite time limit
    if (isScoreMode) {
      if (typeof quiz.timeLimit !== "number" || isNaN(quiz.timeLimit) || quiz.timeLimit <= 0 || !Number.isFinite(quiz.timeLimit)) {
        return res.status(400).json({
          message: "Bài thi tính điểm yêu cầu thời gian làm bài hợp lệ (phút > 0)"
        });
      }
    }
    const question = await Question.find({
      quizId
    });
    const questionImage = await QuestionIMG.find({
      quizId
    });
    const questions = [...question, ...questionImage];

    // Reject empty quiz
    if (!questions || questions.length === 0) {
      return res.status(400).json({
        message: "Quiz chưa có câu hỏi nào"
      });
    }
    if (new Set(questions.map(q => String(q._id))).size !== questions.length || questions.some(q => !Array.isArray(q.options) || q.options.length < 2 || q.options.some(option => typeof option !== 'string' || !option.trim()) || new Set(q.options).size !== q.options.length || !q.options.includes(q.answer))) {
      return res.status(409).json({
        message: 'Bộ đề có câu hỏi chưa hợp lệ. Vui lòng báo quản trị viên kiểm tra.'
      });
    }
    const {
      attempt,
      error
    } = createAttempt({
      quizId,
      userId: req.user.id,
      scoreMode: isScoreMode,
      timeLimitMinutes: quiz.timeLimit || 0,
      questions
    });
    if (error) {
      return res.status(429).json({
        message: "Bạn có quá nhiều lượt làm bài đang hoạt động, vui lòng hoàn thành hoặc chờ hết hạn"
      });
    }

    // Strip answers and explain for scored attempts; practice allows them
    const returnedQuestions = attempt.questions.map(q => {
      const qCopy = {
        ...q
      };
      if (isScoreMode) {
        delete qCopy.answer;
        delete qCopy.explain;
      }
      return qCopy;
    });
    return res.status(201).json({
      attemptId: attempt.attemptId,
      quiz: {
        ...quiz.toObject(),
        questions: returnedQuestions
      },
      expiresAt: attempt.expiresAt,
      deadlineAt: isScoreMode ? new Date(attempt.startTime.getTime() + quiz.timeLimit * 60000) : null
    });
  } catch (_error) {
    return res.status(500).json({
      message: "Lỗi khi tạo lượt làm bài"
    });
  }
};
