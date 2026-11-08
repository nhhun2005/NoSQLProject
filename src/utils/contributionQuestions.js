export const getQuestionValidationErrors = (q) => {
  const errs = [];
  if (!q || typeof q !== "object") {
    return ["Dữ liệu câu hỏi không hợp lệ"];
  }

  const questionText = typeof q.question === "string" ? q.question.trim() : "";
  if (!questionText) {
    errs.push("Nội dung câu hỏi không được để trống");
  } else if (questionText.length > 5000) {
    errs.push("Nội dung câu hỏi quá dài (tối đa 5000 ký tự)");
  }

  const rawOptions = Array.isArray(q.options) ? q.options : [];
  // Reject any blank option (do not filter out blanks!)
  const hasBlankOption = rawOptions.some(
    (o) => typeof o !== "string" || !o.trim()
  );
  if (hasBlankOption) {
    errs.push("Không được để trống bất kỳ phương án nào");
  }

  const hasTooLongOption = rawOptions.some(
    (o) => typeof o === "string" && o.trim().length > 2000
  );
  if (hasTooLongOption) {
    errs.push("Phương án trả lời quá dài (tối đa 2000 ký tự)");
  }

  if (rawOptions.length < 2) {
    errs.push("Cần ít nhất 2 phương án lựa chọn");
  }
  if (rawOptions.length > 8) {
    errs.push("Tối đa 8 phương án lựa chọn");
  }

  const trimmedOptions = rawOptions.map((o) =>
    typeof o === "string" ? o.trim() : ""
  );
  const unique = new Set(trimmedOptions);
  if (unique.size !== rawOptions.length) {
    errs.push("Các phương án không được trùng lặp nội dung");
  }

  const answer = typeof q.answer === "string" ? q.answer.trim() : "";
  if (!answer || !trimmedOptions.includes(answer)) {
    errs.push("Chỉ hỗ trợ một đáp án đúng khớp chính xác với một phương án. Không ghép nhiều đáp án bằng dấu ;");
  }

  if (q.explain !== undefined && q.explain !== null && typeof q.explain !== "string") {
    errs.push("Lời giải thích phải là chuỗi ký tự");
  }
  if (typeof q.explain === "string" && q.explain.trim().length > 5000) {
    errs.push("Lời giải thích quá dài (tối đa 5000 ký tự)");
  }

  return errs;
};

