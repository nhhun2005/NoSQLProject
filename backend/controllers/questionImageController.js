// 📁 controllers/questionImageController.js
import QuestionImage from "../models/questionImage.js";

// Lấy tất cả câu hỏi hình ảnh
export const getQuestionImages = async (req, res) => {
  try {
    const questions = await QuestionImage.find();
    return res.status(200).json(questions);
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi lấy danh sách câu hỏi hình ảnh"
    });
  }
};
export const getQuestionImagesById = async (req, res) => {
  try {
    const questions = await QuestionImage.find({
      quizId: req.params.id
    });
    return res.status(200).json(questions);
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi lấy câu hỏi hình ảnh"
    });
  }
};

// Thêm câu hỏi
export const addQuestionImage = async (req, res) => {
  try {
    const {
      quizId,
      question,
      image,
      options,
      answer,
      explain
    } = req.body || {};
    const newQuestionImage = new QuestionImage({
      quizId,
      question,
      image,
      options,
      answer,
      explain
    });
    await newQuestionImage.save();
    return res.status(201).json(newQuestionImage);
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi thêm câu hỏi hình ảnh"
    });
  }
};

// Xóa câu hỏi
export const deleteQuestionImage = async (req, res) => {
  try {
    await QuestionImage.findByIdAndDelete(req.params.id);
    return res.status(200).json({
      message: "Deleted successfully"
    });
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi xóa câu hỏi hình ảnh"
    });
  }
};
