import { useState } from "react";

export default function ContributionPreview({
  questions = [],
  warnings = [],
  onChangeQuestion,
  onDeleteQuestion,
  onAddQuestion,
  confirmed,
  onToggleConfirm,
  onSubmit,
  submitting = false,
  busy = false,
  submitError = "",
  isMetadataValid = true,
  metadataError = ""
}) {
  const [filterInvalid, setFilterInvalid] = useState(false);

  // Helper to validate single question
  const getQuestionValidationErrors = (q) => {
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
      errs.push("Chưa chọn đáp án đúng (hoặc đáp án không khớp)");
    }

    if (q.explain && typeof q.explain === "string" && q.explain.trim().length > 5000) {
      errs.push("Lời giải thích quá dài (tối đa 5000 ký tự)");
    }

    return errs;
  };

  const invalidQuestionsCount = questions.filter(
    (q) => getQuestionValidationErrors(q).length > 0
  ).length;

  const isFormValid =
    questions.length > 0 &&
    questions.length <= 200 &&
    invalidQuestionsCount === 0 &&
    isMetadataValid;

  const handleOptionChange = (qIndex, optIndex, newVal) => {
    const currentQ = questions[qIndex];
    const newOptions = [...currentQ.options];
    const oldVal = newOptions[optIndex];
    newOptions[optIndex] = newVal;

    // If answer matched old value, update answer as well
    let newAnswer = currentQ.answer;
    if (currentQ.answer === oldVal) {
      newAnswer = newVal;
    }

    onChangeQuestion(qIndex, {
      ...currentQ,
      options: newOptions,
      answer: newAnswer
    });
  };

  const handleAddOption = (qIndex) => {
    const currentQ = questions[qIndex];
    if (currentQ.options.length >= 8) return;
    onChangeQuestion(qIndex, {
      ...currentQ,
      options: [...currentQ.options, `Phương án ${currentQ.options.length + 1}`]
    });
  };

  const handleRemoveOption = (qIndex, optIndex) => {
    const currentQ = questions[qIndex];
    if (currentQ.options.length <= 2) return;
    const removedVal = currentQ.options[optIndex];
    const newOptions = currentQ.options.filter((_, idx) => idx !== optIndex);
    let newAnswer = currentQ.answer;
    if (newAnswer === removedVal) {
      newAnswer = "";
    }
    onChangeQuestion(qIndex, {
      ...currentQ,
      options: newOptions,
      answer: newAnswer
    });
  };

  const isDisabled = busy || submitting;

  return (
    <fieldset disabled={isDisabled} className="border-0 p-0 m-0 min-w-0 flex flex-col gap-6 mt-6">
      {/* Top Banner: Stats & Filter */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            📋 Xem Trước Câu Hỏi ({questions.length}/200)
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Bạn có thể chỉnh sửa nội dung, thêm/bớt phương án, và chọn lại đáp án đúng cho từng câu.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {invalidQuestionsCount > 0 ? (
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
              ⚠️ {invalidQuestionsCount} câu cần chỉnh sửa
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
              ✅ Toàn bộ {questions.length} câu đã hợp lệ
            </span>
          )}

          {invalidQuestionsCount > 0 && (
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => setFilterInvalid((prev) => !prev)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {filterInvalid ? "Hiện tất cả" : "Chỉ hiện câu lỗi"}
            </button>
          )}
        </div>
      </div>

      {/* Warnings from AI / CSV Extraction */}
      {warnings && warnings.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-5">
          <h3 className="font-bold text-amber-800 text-base flex items-center gap-2">
            ⚠️ Lưu ý trích xuất từ hệ thống ({warnings.length}):
          </h3>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-amber-900 max-h-48 overflow-y-auto">
            {warnings.map((warn, wIdx) => (
              <li key={wIdx}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Questions List */}
      <div className="flex flex-col gap-5">
        {questions.map((q, qIndex) => {
          const errors = getQuestionValidationErrors(q);
          const hasError = errors.length > 0;

          if (filterInvalid && !hasError) {
            return null;
          }

          return (
            <div
              key={qIndex}
              className={`bg-white border rounded-xl p-5 shadow-sm transition-all ${
                hasError ? "border-red-300 bg-red-50/20" : "border-gray-200"
              }`}
            >
              {/* Question Header */}
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-lg text-green-700">
                    Câu {qIndex + 1}
                  </span>
                  {hasError ? (
                    <span className="text-xs px-2.5 py-1 rounded bg-red-100 text-red-700 font-medium">
                      ⚠️ Cần bổ sung thông tin
                    </span>
                  ) : (
                    <span className="text-xs px-2.5 py-1 rounded bg-green-100 text-green-700 font-medium">
                      ✓ Đạt chuẩn
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteQuestion(qIndex)}
                  disabled={questions.length <= 1 || isDisabled}
                  aria-label={`Xóa câu hỏi ${qIndex + 1}`}
                  className="text-xs text-red-600 hover:text-red-800 hover:underline disabled:opacity-30 disabled:cursor-not-allowed font-medium cursor-pointer"
                >
                  🗑 Xóa câu này
                </button>
              </div>

              {/* Error list for this question */}
              {hasError && (
                <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <ul className="list-disc list-inside space-y-0.5">
                    {errors.map((e, eIdx) => (
                      <li key={eIdx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Question Text */}
              <div className="flex flex-col gap-1.5 mb-4">
                <label
                  htmlFor={`q-text-${qIndex}`}
                  className="text-sm font-semibold text-gray-700"
                >
                  Nội dung câu hỏi:
                </label>
                <textarea
                  id={`q-text-${qIndex}`}
                  aria-label={`Nội dung câu hỏi ${qIndex + 1}`}
                  rows={2}
                  value={q.question || ""}
                  disabled={isDisabled}
                  onChange={(e) =>
                    onChangeQuestion(qIndex, { ...q, question: e.target.value })
                  }
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none disabled:bg-gray-100"
                  placeholder="Nhập nội dung câu hỏi..."
                />
              </div>

              {/* Options */}
              <div className="flex flex-col gap-2 mb-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700">
                    Các phương án trả lời ({q.options?.length || 0}/8):
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAddOption(qIndex)}
                    disabled={(q.options?.length || 0) >= 8 || isDisabled}
                    aria-label={`Thêm phương án cho câu hỏi ${qIndex + 1}`}
                    className="text-xs text-green-700 hover:text-green-800 font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    + Thêm phương án
                  </button>
                </div>

                <div className="space-y-2">
                  {(q.options || []).map((opt, optIndex) => {
                    const isCorrect = q.answer && q.answer === opt;
                    return (
                      <div
                        key={optIndex}
                        className={`flex items-center gap-2 p-2 rounded-lg border ${
                          isCorrect
                            ? "bg-green-50 border-green-400"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <button
                          type="button"
                          title="Đặt làm đáp án đúng"
                          aria-label={`Đặt phương án ${String.fromCharCode(65 + optIndex)} làm đáp án đúng cho câu ${qIndex + 1}`}
                          disabled={isDisabled}
                          onClick={() =>
                            onChangeQuestion(qIndex, { ...q, answer: opt })
                          }
                          className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed ${
                            isCorrect
                              ? "bg-green-600 text-white"
                              : "bg-gray-200 text-gray-600 hover:bg-green-200"
                          }`}
                        >
                          {String.fromCharCode(65 + optIndex)}
                        </button>

                        <input
                          id={`q-opt-${qIndex}-${optIndex}`}
                          aria-label={`Phương án ${String.fromCharCode(65 + optIndex)} của câu ${qIndex + 1}`}
                          type="text"
                          value={opt}
                          disabled={isDisabled}
                          onChange={(e) =>
                            handleOptionChange(qIndex, optIndex, e.target.value)
                          }
                          className="min-w-0 w-full flex-1 p-1.5 bg-white border border-gray-300 rounded text-sm outline-none focus:border-green-600 disabled:bg-gray-100"
                          placeholder={`Phương án ${String.fromCharCode(65 + optIndex)}`}
                        />

                        {isCorrect && (
                          <span className="shrink-0 text-xs text-green-700 font-bold px-1.5">
                            ✓ Đúng
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveOption(qIndex, optIndex)}
                          disabled={(q.options?.length || 0) <= 2 || isDisabled}
                          className="shrink-0 text-gray-400 hover:text-red-500 disabled:opacity-20 text-sm px-1.5 font-bold cursor-pointer disabled:cursor-not-allowed"
                          title="Xóa phương án này"
                          aria-label={`Xóa phương án ${String.fromCharCode(65 + optIndex)} của câu ${qIndex + 1}`}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Answer Selector Dropdown */}
              <div className="flex flex-col gap-1.5 mb-4">
                <label
                  htmlFor={`q-ans-${qIndex}`}
                  className="text-sm font-semibold text-gray-700"
                >
                  Đáp án đúng:
                </label>
                <select
                  id={`q-ans-${qIndex}`}
                  aria-label={`Đáp án đúng cho câu hỏi ${qIndex + 1}`}
                  value={q.answer || ""}
                  disabled={isDisabled}
                  onChange={(e) =>
                    onChangeQuestion(qIndex, { ...q, answer: e.target.value })
                  }
                  className={`w-full p-2.5 rounded-lg border text-sm outline-none disabled:bg-gray-100 ${
                    !q.answer || !(q.options || []).includes(q.answer)
                      ? "border-red-400 bg-red-50 text-red-700 font-medium"
                      : "border-green-500 bg-green-50/50 text-green-800 font-medium"
                  }`}
                >
                  <option value="">-- Chọn đáp án đúng cho câu hỏi --</option>
                  {(q.options || []).map((opt, oIdx) => (
                    <option key={oIdx} value={opt}>
                      {String.fromCharCode(65 + oIdx)}. {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Explanation */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`q-explain-${qIndex}`}
                  className="text-sm font-semibold text-gray-700"
                >
                  Lời giải thích (tùy chọn):
                </label>
                <textarea
                  id={`q-explain-${qIndex}`}
                  aria-label={`Lời giải thích cho câu hỏi ${qIndex + 1}`}
                  rows={1}
                  value={q.explain || ""}
                  disabled={isDisabled}
                  onChange={(e) =>
                    onChangeQuestion(qIndex, { ...q, explain: e.target.value })
                  }
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:border-green-600 outline-none disabled:bg-gray-100"
                  placeholder="Nhập giải thích cho đáp án..."
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Question Button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onAddQuestion}
          disabled={questions.length >= 200 || isDisabled}
          aria-label="Thêm câu hỏi mới"
          className="py-2.5 px-6 border-2 border-dashed border-green-600 text-green-700 hover:bg-green-50 font-semibold rounded-xl text-sm transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          ➕ Thêm câu hỏi mới ({questions.length}/200)
        </button>
      </div>

      {/* Confirmation & Final Submit Box */}
      <div className="bg-white border-2 border-green-500 rounded-xl p-6 shadow-md flex flex-col gap-4">
        <h3 className="font-bold text-xl text-green-800">
          🚀 Hoàn Tất & Gửi Duyệt
        </h3>

        {/* Validation issues warning */}
        {!isFormValid && (
          <div className="p-3.5 bg-red-50 border-l-4 border-red-500 rounded text-sm text-red-800">
            <p className="font-semibold mb-1">Chưa thể gửi duyệt vì các lý do sau:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              {invalidQuestionsCount > 0 && (
                <li>Còn {invalidQuestionsCount} câu hỏi chưa hoàn thiện hoặc thiếu đáp án đúng.</li>
              )}
              {questions.length === 0 && <li>Chưa có câu hỏi nào trong đề.</li>}
              {questions.length > 200 && <li>Số lượng câu hỏi vượt quá 200 câu.</li>}
              {metadataError && <li>{metadataError}</li>}
            </ul>
          </div>
        )}

        {/* Submit Error message */}
        {submitError && (
          <div className="p-3.5 bg-red-50 border border-red-300 rounded text-sm text-red-700">
            {submitError}
          </div>
        )}

        {/* Confirmation Checkbox */}
        <label
          htmlFor="preview-confirm-checkbox"
          className="flex items-start gap-3 cursor-pointer select-none bg-gray-50 p-4 rounded-lg border border-gray-200"
        >
          <input
            id="preview-confirm-checkbox"
            type="checkbox"
            aria-label="Xác nhận kiểm tra kỹ nội dung trước khi gửi duyệt"
            checked={confirmed}
            disabled={isDisabled}
            onChange={(e) => onToggleConfirm(e.target.checked)}
            className="w-5 h-5 mt-0.5 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer disabled:cursor-not-allowed"
          />
          <span className="text-sm text-gray-800 leading-relaxed font-medium">
            Tôi xác nhận đã kiểm tra kỹ toàn bộ nội dung câu hỏi, các phương án lựa chọn và đáp án đúng trước khi gửi tới ban quản trị phê duyệt.
          </span>
        </label>

        {/* Submit Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <p className="text-xs text-gray-500">
            * Đề sau khi gửi sẽ ở trạng thái chờ duyệt (Pending) và sẽ được ban quản trị kiểm tra trước khi xuất bản.
          </p>

          <button
            type="button"
            onClick={onSubmit}
            disabled={!isFormValid || !confirmed || isDisabled}
            aria-label="Gửi đề cho quản trị viên duyệt"
            className="w-full sm:w-auto px-8 py-3.5 bg-green-700 hover:bg-green-800 text-white font-bold text-base rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? "⏳ Đang gửi đề duyệt..." : "📤 Gửi admin duyệt"}
          </button>
        </div>
      </div>
    </fieldset>
  );
}
