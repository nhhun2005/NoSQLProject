// 📁 controllers/subjectController.js
import Subject from "../models/subject.js";
export const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find();
    return res.status(200).json(subjects);
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi lấy danh sách môn học"
    });
  }
};
export const addSubject = async (req, res) => {
  try {
    const {
      name,
      image,
      description,
      availability
    } = req.body || {};
    const newSubject = new Subject({
      name,
      image,
      description,
      availability: availability !== undefined ? availability : true
    });
    await newSubject.save();
    return res.status(201).json(newSubject);
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi khi thêm môn học"
    });
  }
};
export const deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) {
      return res.status(404).json({
        message: "Not found subject"
      });
    }
    return res.status(200).json({
      message: "Xóa môn học thành công",
      deletedSubject: subject
    });
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi server khi xóa môn học"
    });
  }
};
export const getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({
        message: "Không tìm thấy subject"
      });
    }
    return res.status(200).json(subject);
  } catch (_err) {
    return res.status(500).json({
      message: "Lỗi server"
    });
  }
};
export const updateSubjectAvailability = async (req, res) => {
  try {
    const {
      availability
    } = req.body || {};
    const subject = await Subject.findByIdAndUpdate(req.params.id, {
      availability: Boolean(availability)
    }, {
      new: true
    });
    if (!subject) {
      return res.status(404).json({
        message: "Không tìm thấy subject"
      });
    }
    return res.status(200).json({
      message: "Cập nhật thành công",
      updatedSubject: subject
    });
  } catch (_error) {
    return res.status(500).json({
      message: "Lỗi server khi cập nhật subject"
    });
  }
};
