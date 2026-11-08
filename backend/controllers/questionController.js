// backend/controllers/questionController.js
import Question from "../models/questionText.js";

// Lấy tất cả câu hỏi
export const getQuestions = async (req, res) => {
  try {
    const questions = await Question.find();
    return res.status(200).json(questions);
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi lấy danh sách câu hỏi"
    });
  }
};

// Lấy câu hỏi theo quizId
export const getQuestionsById = async (req, res) => {
  try {
    const questions = await Question.find({
      quizId: req.params.id
    });
    return res.status(200).json(questions);
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi lấy câu hỏi"
    });
  }
};

// Thêm câu hỏi mới
export const addQuestion = async (req, res) => {
  try {
    const {
      quizId,
      question,
      options,
      answer,
      explain
    } = req.body || {};
    const newQuestion = new Question({
      quizId,
      question,
      options,
      answer,
      explain
    });
    await newQuestion.save();
    return res.status(201).json(newQuestion);
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi thêm câu hỏi"
    });
  }
};

// Xóa câu hỏi
export const deleteQuestion = async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.id);
    return res.status(200).json({
      message: "Deleted successfully"
    });
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi xóa câu hỏi"
    });
  }
};
