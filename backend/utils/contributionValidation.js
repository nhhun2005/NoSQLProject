import mongoose from "mongoose";
import Subject from "../models/subject.js";
import Chapter from "../models/chapter.js";

const MAX_QUESTIONS = 200;
const MIN_QUESTIONS = 1;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;
const MAX_QUESTION_LENGTH = 5000;
const MAX_OPTION_LENGTH = 2000;
const MAX_EXPLAIN_LENGTH = 5000;
const MAX_NAME_LENGTH = 200;
const MAX_SUGGESTION_LENGTH = 200;
const MAX_NOTE_LENGTH = 2000;

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ValidationError";
    this.status = status;
  }
}

/**
 * Validates and sanitizes questions for final submission.
 * Strictly requires answer to match one of the unique options.
 * @param {Array<object>} rawQuestions
 * @returns {Array<object>} sanitized questions
 */
export function validateSubmitQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    throw new ValidationError(
      "Danh sách câu hỏi không được để trống (cần ít nhất 1 câu hỏi)."
    );
  }

  if (rawQuestions.length > MAX_QUESTIONS) {
    throw new ValidationError(
      `Bộ đề chứa ${rawQuestions.length} câu hỏi, vượt quá giới hạn tối đa ${MAX_QUESTIONS} câu.`
    );
  }

  const sanitized = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i];
    const indexStr = `Câu hỏi số ${i + 1}`;

    if (!q || typeof q !== "object") {
      throw new ValidationError(`${indexStr}: Dữ liệu câu hỏi không hợp lệ.`);
    }

    // Validate question text
    if (typeof q.question !== "string" || !q.question.trim()) {
      throw new ValidationError(`${indexStr}: Nội dung câu hỏi không được để trống.`);
    }
    const questionText = q.question.trim();
    if (questionText.length > MAX_QUESTION_LENGTH) {
      throw new ValidationError(
        `${indexStr}: Nội dung câu hỏi quá dài (tối đa ${MAX_QUESTION_LENGTH} ký tự).`
      );
    }

    // Validate options
    if (!Array.isArray(q.options)) {
      throw new ValidationError(`${indexStr}: Danh sách phương án trả lời không hợp lệ.`);
    }

    if (
      q.options.length < MIN_OPTIONS ||
      q.options.length > MAX_OPTIONS
    ) {
      throw new ValidationError(
        `${indexStr}: Số lượng phương án phải từ ${MIN_OPTIONS} đến ${MAX_OPTIONS} lựa chọn.`
      );
    }

    const trimmedOptions = [];
    for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
      const opt = q.options[optIdx];
      if (typeof opt !== "string") {
        throw new ValidationError(`${indexStr}: Phương án trả lời phải là chuỗi ký tự.`);
      }
      const trimmed = opt.trim();
      if (trimmed.length === 0) {
        throw new ValidationError(
          `${indexStr}: Có phương án trả lời bị để trống.`
        );
      }
      if (trimmed.length > MAX_OPTION_LENGTH) {
        throw new ValidationError(
          `${indexStr}: Phương án trả lời quá dài (tối đa ${MAX_OPTION_LENGTH} ký tự).`
        );
      }
      trimmedOptions.push(trimmed);
    }

    const uniqueSet = new Set(trimmedOptions);
    if (uniqueSet.size !== trimmedOptions.length) {
      throw new ValidationError(
        `${indexStr}: Các phương án lựa chọn không được trùng lặp nội dung.`
      );
    }

    // Validate answer
    if (typeof q.answer !== "string") {
      throw new ValidationError(
        `${indexStr}: Chưa chọn đáp án đúng.`
      );
    }
    const answer = q.answer.trim();
    if (!answer) {
      throw new ValidationError(
        `${indexStr}: Chưa chọn đáp án đúng.`
      );
    }

    if (!trimmedOptions.includes(answer)) {
      throw new ValidationError(
        `${indexStr}: Đáp án đúng ("${answer}") phải khớp chính xác với một trong các phương án lựa chọn.`
      );
    }

    if (q.explain !== undefined && q.explain !== null && typeof q.explain !== "string") {
      throw new ValidationError(`${indexStr}: Lời giải thích phải là chuỗi ký tự.`);
    }
    const explain =
      typeof q.explain === "string" ? q.explain.trim() : "";
    if (explain.length > MAX_EXPLAIN_LENGTH) {
      throw new ValidationError(
        `${indexStr}: Lời giải thích quá dài (tối đa ${MAX_EXPLAIN_LENGTH} ký tự).`
      );
    }

    // Never spread raw request into model; ignore unknown fields
    sanitized.push({
      question: questionText,
      options: trimmedOptions,
      answer,
      explain
    });
  }

  return sanitized;
}

/**
 * Validates subject, chapter, and suggestion fields against the database.
 * Formats suggestions cleanly into adminNote without altering schema.
 * @param {object} input
 * @param {string|null} input.subjectId
 * @param {string|null} input.chapterId
 * @param {string|null} input.suggestedSubject
 * @param {string|null} input.suggestedChapter
 * @param {string|null} [input.note]
 * @returns {Promise<{ validSubjectId: object|null, validChapterId: object|null, formattedAdminNote: string }>}
 */
export async function validateSubjectAndChapter({
  subjectId,
  chapterId,
  suggestedSubject,
  suggestedChapter,
  note = ""
}) {
  if (subjectId !== undefined && subjectId !== null && typeof subjectId !== "string") {
    throw new ValidationError("Mã môn học không hợp lệ.");
  }
  if (chapterId !== undefined && chapterId !== null && typeof chapterId !== "string") {
    throw new ValidationError("Mã chương không hợp lệ.");
  }

  const isOtherSubject =
    !subjectId ||
    subjectId.trim() === "" ||
    subjectId === "other" ||
    subjectId === "null";

  let validSubjectId = null;
  let validChapterId = null;
  const adminNotes = [];

  if (isOtherSubject) {
    if (
      chapterId !== undefined &&
      chapterId !== null &&
      chapterId.trim() !== "" &&
      chapterId !== "null"
    ) {
      throw new ValidationError("Không thể chỉ định chương khi chọn môn học khác.");
    }

    if (suggestedSubject !== undefined && suggestedSubject !== null && typeof suggestedSubject !== "string") {
      throw new ValidationError("Tên môn học gợi ý phải là chuỗi ký tự.");
    }
    if (suggestedChapter !== undefined && suggestedChapter !== null && typeof suggestedChapter !== "string") {
      throw new ValidationError("Tên chương gợi ý phải là chuỗi ký tự.");
    }

    const sSub = typeof suggestedSubject === "string" ? suggestedSubject.trim() : "";
    const sChap = typeof suggestedChapter === "string" ? suggestedChapter.trim() : "";

    if (!sSub) {
      throw new ValidationError(
        "Khi chọn 'Môn học khác', bạn phải nhập tên môn học gợi ý."
      );
    }
    if (sSub.length > MAX_SUGGESTION_LENGTH) {
      throw new ValidationError(
        `Tên môn học gợi ý quá dài (tối đa ${MAX_SUGGESTION_LENGTH} ký tự).`
      );
    }

    if (!sChap) {
      throw new ValidationError(
        "Khi chọn 'Môn học khác', bạn phải nhập tên chương gợi ý."
      );
    }
    if (sChap.length > MAX_SUGGESTION_LENGTH) {
      throw new ValidationError(
        `Tên chương gợi ý quá dài (tối đa ${MAX_SUGGESTION_LENGTH} ký tự).`
      );
    }

    adminNotes.push(`[Gợi ý môn học]: ${sSub}`);
    adminNotes.push(`[Gợi ý chương]: ${sChap}`);
  } else {
    // Subject is selected from DB
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      throw new ValidationError("Mã môn học không hợp lệ.");
    }

    const subject = await Subject.findById(subjectId);
    if (!subject || subject.availability === false) {
      throw new ValidationError("Môn học không tồn tại hoặc hiện không khả dụng.");
    }
    validSubjectId = subject._id;

    const isOtherChapter =
      !chapterId ||
      chapterId.trim() === "" ||
      chapterId === "other" ||
      chapterId === "null";

    if (isOtherChapter) {
      if (suggestedChapter !== undefined && suggestedChapter !== null && typeof suggestedChapter !== "string") {
        throw new ValidationError("Tên chương gợi ý phải là chuỗi ký tự.");
      }
      const sChap = typeof suggestedChapter === "string" ? suggestedChapter.trim() : "";
      if (!sChap) {
        throw new ValidationError(
          "Khi chọn 'Chương khác', bạn phải nhập tên chương gợi ý."
        );
      }
      if (sChap.length > MAX_SUGGESTION_LENGTH) {
        throw new ValidationError(
          `Tên chương gợi ý quá dài (tối đa ${MAX_SUGGESTION_LENGTH} ký tự).`
        );
      }
      adminNotes.push(`[Gợi ý chương]: ${sChap}`);
    } else {
      // Chapter is selected from DB
      if (!mongoose.Types.ObjectId.isValid(chapterId)) {
        throw new ValidationError("Mã chương không hợp lệ.");
      }

      const chapter = await Chapter.findById(chapterId);
      if (!chapter || chapter.availability === false) {
        throw new ValidationError("Chương không tồn tại hoặc hiện không khả dụng.");
      }

      if (String(chapter.subjectId) !== String(subject._id)) {
        throw new ValidationError(
          "Chương đã chọn không thuộc môn học đã chọn."
        );
      }
      validChapterId = chapter._id;
    }
  }

  if (note !== undefined && note !== null && note !== "") {
    if (typeof note !== "string") {
      throw new ValidationError("Ghi chú phải là chuỗi ký tự.");
    }
    const trimmedNote = note.trim();
    if (trimmedNote.length > MAX_NOTE_LENGTH) {
      throw new ValidationError(
        `Ghi chú quá dài (tối đa ${MAX_NOTE_LENGTH} ký tự).`
      );
    }
    if (trimmedNote.length > 0) {
      adminNotes.push(`[Ghi chú thêm]: ${trimmedNote}`);
    }
  }

  const formattedAdminNote = adminNotes.join("\n");

  return {
    validSubjectId,
    validChapterId,
    formattedAdminNote
  };
}

/**
 * Validates entire contribution payload for final submission.
 */
export async function validateContributionSubmission(body) {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Dữ liệu gửi lên không hợp lệ.");
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    throw new ValidationError("Tên bộ đề không được để trống.");
  }
  const name = body.name.trim();
  if (name.length > MAX_NAME_LENGTH) {
    throw new ValidationError(
      `Tên bộ đề quá dài (tối đa ${MAX_NAME_LENGTH} ký tự).`
    );
  }

  let timeLimit = 45;
  if (body.timeLimit !== undefined && body.timeLimit !== null && body.timeLimit !== "") {
    if (
      typeof body.timeLimit === "boolean" ||
      Array.isArray(body.timeLimit) ||
      (typeof body.timeLimit === "object" && body.timeLimit !== null)
    ) {
      throw new ValidationError(
        "Thời gian làm bài phải là số nguyên từ 1 đến 300 phút."
      );
    }
    const parsed =
      typeof body.timeLimit === "number"
        ? body.timeLimit
        : Number(String(body.timeLimit).trim());
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 300) {
      throw new ValidationError(
        "Thời gian làm bài phải là số nguyên từ 1 đến 300 phút."
      );
    }
    timeLimit = parsed;
  }

  const rawNote = body.note !== undefined ? body.note : body.suggestedNote;
  if (rawNote !== undefined && rawNote !== null && rawNote !== "") {
    if (typeof rawNote !== "string") {
      throw new ValidationError("Ghi chú phải là chuỗi ký tự.");
    }
    if (rawNote.trim().length > MAX_NOTE_LENGTH) {
      throw new ValidationError(
        `Ghi chú quá dài (tối đa ${MAX_NOTE_LENGTH} ký tự).`
      );
    }
  }

  const sanitizedQuestions = validateSubmitQuestions(body.questions);

  const { validSubjectId, validChapterId, formattedAdminNote } =
    await validateSubjectAndChapter({
      subjectId: body.subjectId,
      chapterId: body.chapterId,
      suggestedSubject: body.suggestedSubject,
      suggestedChapter: body.suggestedChapter,
      note: rawNote
    });

  return {
    name,
    subjectId: validSubjectId,
    chapterId: validChapterId,
    timeLimit,
    questions: sanitizedQuestions,
    adminNote: formattedAdminNote
  };
}
