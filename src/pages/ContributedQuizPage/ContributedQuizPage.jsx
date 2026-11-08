import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { MdExpandMore as ExpandButton } from "react-icons/md";
import ContributedQuizList from "../../components/ContributedQuizList/ContributedQuizList";
import ContributionPreview from "../../components/ContributionPreview";
import contributedService from "../../services/contributedService";
import subjectService from "../../services/subjectService";
import chapterService from "../../services/chapterService";
import { getQuestionValidationErrors } from "../../utils/contributionQuestions";

export default function ContributedQuizPage() {
  const { account, isAuthenticated } = useSelector((state) => state.user);
  const mode = useSelector((state) => state.viewMode.mode);

  // Data states
  const [dataError, setDataError] = useState("");
  const [retry, setRetry] = useState(0);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null); // null, { _id: null, name: "Khác" }, or DB subject
  const [selectedChapter, setSelectedChapter] = useState(null); // null, { _id: null, name: "Khác (Chương mới)" }, or DB chapter
  const [expandSubject, setExpandSubject] = useState(false);
  const [expandChapter, setExpandChapter] = useState(false);

  // Metadata inputs
  const [quizName, setQuizName] = useState("");
  const [timeLimit, setTimeLimit] = useState(45);
  const [suggestedSubject, setSuggestedSubject] = useState("");
  const [suggestedChapter, setSuggestedChapter] = useState("");
  const [contributionStats, setContributionStats] = useState(null);

  // File & Preview states
  const [selectedFile, setSelectedFile] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [previewData, setPreviewData] = useState(null); // { name, questions, warnings }
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");

  const subjectRef = useRef(null);
  const chapterRef = useRef(null);
  const fileInputRef = useRef(null);
  const importBusyRef = useRef(false);
  const submittingRef = useRef(false);

  // Fetch contribution stats
  useEffect(() => {
    if (!isAuthenticated || !account?.accessToken) return;
    contributedService
      .getStats()
      .then((res) => setContributionStats(res.data))
      .catch(() => setDataError("Không tải được thống kê đóng góp."));
  }, [isAuthenticated, account?.accessToken, retry]);

  // Click outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (subjectRef.current && !subjectRef.current.contains(event.target)) {
        setExpandSubject(false);
      }
      if (chapterRef.current && !chapterRef.current.contains(event.target)) {
        setExpandChapter(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Fetch subjects
  useEffect(() => {
    setDataError("");
    subjectService
      .getAll()
      .then((res) => setSubjects(res.data || []))
      .catch(() => setDataError("Không tải được danh sách môn học."));
  }, [retry]);

  // Fetch chapters when subject changes
  useEffect(() => {
    setChapters([]);
    let active = true;

    if (selectedSubject && selectedSubject._id) {
      chapterService
        .getBySubject(selectedSubject._id)
        .then((res) => {
          if (active) {
            setChapters(res.data || []);
          }
        })
        .catch(() => {
          if (active) {
            setDataError("Không tải được danh sách chương.");
          }
        });
    }

    return () => {
      active = false;
    };
  }, [selectedSubject, retry]);

  // File selection change
  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setPreviewData(null);
    setConfirmed(false);
    setImportStatus("");
    setSubmitStatus("");
  };

  // Import preview action
  const handleImportPreview = async () => {
    if (importBusyRef.current || importBusy || submittingRef.current || submitting) return;

    if (!selectedFile) {
      setImportStatus("⚠️ Vui lòng chọn file PDF hoặc CSV!");
      return;
    }

    if (!isAuthenticated || !account?.accessToken) {
      setImportStatus("⚠️ Bạn cần đăng nhập trước khi xử lý tài liệu!");
      return;
    }

    if (contributionStats && contributionStats.remaining === 0) {
      setImportStatus("🚫 Bạn đã đạt giới hạn đóng góp đề trong 7 ngày gần nhất!");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    importBusyRef.current = true;
    setImportBusy(true);
    setConfirmed(false);
    setImportStatus(
      selectedFile.name.endsWith(".pdf")
        ? "⏳ Đang phân tích PDF và trích xuất câu hỏi bằng AI... (có thể mất 30-60 giây)"
        : "⏳ Đang đọc và phân tích file CSV..."
    );

    try {
      const res = await contributedService.importPreview(formData);
      setPreviewData(res.data);
      const invalidCount = (res.data.questions || []).filter(
        (q) => getQuestionValidationErrors(q).length > 0
      ).length;
      setImportStatus(invalidCount > 0
        ? `⚠️ Đã trích xuất nội dung, nhưng có ${invalidCount} câu cần sửa. Chưa thể gửi duyệt; xem các câu lỗi bên dưới.`
        : res.data.warnings?.length > 0
          ? "⚠️ Đã trích xuất nội dung có cảnh báo. Vui lòng đối chiếu bản gốc trước khi gửi duyệt."
          : "✅ Trích xuất nội dung thành công! Vui lòng kiểm tra bản xem trước.");

      // If quiz name is empty, auto-fill with suggested title from import
      if (!quizName.trim() && res.data.name) {
        setQuizName(res.data.name);
      }
    } catch (err) {
      console.error("Import error:", err);
      const errMsg =
        err.response?.data?.message ||
        "❌ Lỗi khi xử lý file. Vui lòng kiểm tra định dạng hoặc thử lại sau!";
      setImportStatus(errMsg);
      // Preserve existing edited preview on reimport error instead of discarding
    } finally {
      importBusyRef.current = false;
      setImportBusy(false);
    }
  };

  // Validate metadata
  const isOtherSubject = selectedSubject && selectedSubject._id === null;
  const isOtherChapter = selectedChapter && selectedChapter._id === null;

  let metadataError = "";
  const trimmedName = quizName.trim();
  const parsedTime = Number(timeLimit);

  if (!trimmedName) {
    metadataError = "Vui lòng nhập tên bộ đề.";
  } else if (trimmedName.length > 200) {
    metadataError = "Tên bộ đề không được vượt quá 200 ký tự.";
  } else if (
    timeLimit === "" ||
    timeLimit === null ||
    timeLimit === undefined ||
    !Number.isInteger(parsedTime) ||
    parsedTime < 1 ||
    parsedTime > 300
  ) {
    metadataError = "Thời gian làm bài phải là số nguyên từ 1 đến 300 phút.";
  } else if (!selectedSubject) {
    metadataError = "Vui lòng chọn môn học (hoặc 'Khác').";
  } else if (isOtherSubject) {
    if (!suggestedSubject.trim()) {
      metadataError = "Vui lòng nhập tên môn học gợi ý.";
    } else if (suggestedSubject.trim().length > 200) {
      metadataError = "Tên môn học gợi ý không được vượt quá 200 ký tự.";
    } else if (!suggestedChapter.trim()) {
      metadataError = "Vui lòng nhập tên chương gợi ý.";
    } else if (suggestedChapter.trim().length > 200) {
      metadataError = "Tên chương gợi ý không được vượt quá 200 ký tự.";
    }
  } else {
    // Existing subject
    if (!selectedChapter) {
      metadataError = "Vui lòng chọn chương cho môn học đã chọn.";
    } else if (isOtherChapter) {
      if (!suggestedChapter.trim()) {
        metadataError = "Vui lòng nhập tên chương gợi ý.";
      } else if (suggestedChapter.trim().length > 200) {
        metadataError = "Tên chương gợi ý không được vượt quá 200 ký tự.";
      }
    }
  }

  const isMetadataValid = !metadataError;

  // Final submit action
  const handleFinalSubmit = async () => {
    if (
      submittingRef.current ||
      submitting ||
      importBusyRef.current ||
      importBusy ||
      !previewData
    )
      return;

    if (!isMetadataValid) {
      setSubmitStatus(`⚠️ ${metadataError}`);
      return;
    }

    const questions = previewData.questions || [];
    if (questions.length === 0 || questions.length > 200) {
      setSubmitStatus("⚠️ Đề phải có từ 1 đến 200 câu hỏi.");
      return;
    }
    const invalidIndex = questions.findIndex((q) => getQuestionValidationErrors(q).length > 0);
    if (invalidIndex !== -1) {
      setSubmitStatus(`⚠️ Câu ${invalidIndex + 1}: ${getQuestionValidationErrors(questions[invalidIndex]).join("; ")}`);
      return;
    }

    if (!confirmed) {
      setSubmitStatus("⚠️ Bạn cần đánh dấu xác nhận đã kiểm tra nội dung trước khi gửi!");
      return;
    }

    const payload = {
      name: quizName.trim(),
      subjectId: selectedSubject?._id || null,
      chapterId: selectedChapter?._id || null,
      suggestedSubject: isOtherSubject ? suggestedSubject.trim() : "",
      suggestedChapter: isOtherSubject || isOtherChapter ? suggestedChapter.trim() : "",
      timeLimit: Number(timeLimit),
      questions: previewData.questions
    };

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitStatus("⏳ Đang gửi đề duyệt tới quản trị viên...");

    try {
      const res = await contributedService.submitContribution(payload);
      setSubmitStatus(
        res.data?.message || "✅ Gửi đề đóng góp thành công! Đề đang chờ admin phê duyệt."
      );

      // Refresh stats
      contributedService
        .getStats()
        .then((sRes) => setContributionStats(sRes.data))
        .catch(() => {});

      // Reset form on success
      setPreviewData(null);
      setSelectedFile(null);
      setConfirmed(false);
      setQuizName("");
      setSuggestedSubject("");
      setSuggestedChapter("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Submit error:", err);
      const errMsg =
        err.response?.data?.message ||
        "❌ Lỗi khi gửi đề duyệt. Vui lòng kiểm tra lại thông tin và thử lại!";
      setSubmitStatus(errMsg);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Preview question handlers
  const handleUpdateQuestion = (index, updatedQuestion) => {
    if (!previewData) return;
    const newQuestions = [...previewData.questions];
    newQuestions[index] = updatedQuestion;
    setPreviewData({ ...previewData, questions: newQuestions });
    setConfirmed(false);
  };

  const handleDeleteQuestion = (index) => {
    if (!previewData) return;
    const newQuestions = previewData.questions.filter((_, idx) => idx !== index);
    setPreviewData({ ...previewData, questions: newQuestions });
    setConfirmed(false);
  };

  const handleAddQuestion = () => {
    if (!previewData || previewData.questions.length >= 200) return;
    const newQuestion = {
      question: "",
      options: ["Phương án A", "Phương án B", "Phương án C", "Phương án D"],
      answer: "",
      explain: ""
    };
    setPreviewData({
      ...previewData,
      questions: [...previewData.questions, newQuestion]
    });
    setConfirmed(false);
  };

  // Status text color helper
  const getStatusColor = (statusText) => {
    if (statusText.includes("✅")) return "text-green-700 font-semibold";
    if (statusText.includes("❌") || statusText.includes("⚠️") || statusText.includes("🚫"))
      return "text-red-600 font-semibold";
    if (statusText.includes("⏳")) return "text-amber-600 font-semibold";
    return "text-gray-700";
  };

  return (
    <div className="w-[95%] mx-auto py-4 sm:py-6 flex flex-col gap-8">
      {dataError && (
        <div role="alert" className="p-4 bg-red-50 text-red-900 rounded-lg flex items-center justify-between">
          <p>{dataError}</p>
          <button
            type="button"
            onClick={() => setRetry((v) => v + 1)}
            className="text-sm font-semibold underline hover:no-underline"
          >
            Thử tải lại dữ liệu
          </button>
        </div>
      )}

      {/* Header Introduction */}
      <div className="bg-white rounded-xl shadow-lg shadow-gray-200 p-4 sm:p-8 text-center">
        <h1 className="text-4xl font-extrabold text-green-700">
          Đóng Góp Đề Trắc Nghiệm
        </h1>
        <p className="mt-4 text-gray-600 text-lg max-w-3xl mx-auto">
          Cùng đóng góp những bộ đề câu hỏi chất lượng! Bạn có thể tải lên file{" "}
          <strong>CSV</strong> hoặc tài liệu <strong>PDF</strong>. Hệ thống AI sẽ tự động trích xuất nội dung để bạn xem trước, chỉnh sửa và xác nhận trước khi gửi duyệt.
        </p>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl shadow-lg shadow-gray-200 p-4 sm:p-8 min-h-[400px]">
        {account?.role === "Admin" && mode === "edit" ? (
          <ContributedQuizList />
        ) : (
          <div className="flex flex-col gap-6">
            {/* Weekly Contribution Stats */}
            {contributionStats && isAuthenticated && (
              <div className="bg-blue-50 p-4 rounded-xl border-l-4 border-blue-500 text-base leading-relaxed">
                <p>
                  📊 Bạn đã đóng góp{" "}
                  <strong>
                    {contributionStats.used}/{contributionStats.limit}
                  </strong>{" "}
                  đề trong 7 ngày gần nhất.
                </p>
                {contributionStats.remaining === 0 ? (
                  <p className="text-red-500 font-semibold mt-1">
                    🚫 Bạn đã đạt giới hạn {contributionStats.limit} đề! Hãy thử lại sau vài ngày nhé.
                  </p>
                ) : (
                  <p className="text-green-600 mt-1">
                    ✅ Bạn còn có thể gửi thêm{" "}
                    <strong>{contributionStats.remaining}</strong> đề.
                  </p>
                )}
              </div>
            )}

            {/* Section 1: Metadata Configuration */}
            <fieldset disabled={importBusy || submitting} className="min-w-0 bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 flex flex-col gap-5">
              <h2 className="text-xl font-bold text-green-800 border-b pb-2">
                1. Thông Tin Bộ Đề
              </h2>

              {/* Quiz Name */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-gray-700">
                  Tên bộ đề: <span className="text-red-500">*</span>
                </label>
                <input
                  aria-label="Tên bộ đề"
                  type="text"
                  placeholder="Ví dụ: Đề ôn thi Giữa kỳ 1 Toán 12..."
                  value={quizName}
                  disabled={importBusy || submitting}
                  onChange={(e) => { setQuizName(e.target.value); setConfirmed(false); }}
                  className="w-full py-2.5 px-3 border border-gray-300 rounded-lg text-base outline-none focus:border-green-700 bg-white"
                />
              </div>

              {/* Subject Dropdown */}
              <div ref={subjectRef} className="flex flex-col gap-1.5">
                <label className="font-semibold text-gray-700">
                  Chọn môn học: <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    aria-label="Chọn môn học..."
                    type="text"
                    readOnly
                    disabled={importBusy || submitting}
                    value={
                      selectedSubject && selectedSubject._id !== null
                        ? selectedSubject.name
                        : selectedSubject && selectedSubject._id === null
                        ? "Khác (Môn học mới)"
                        : ""
                    }
                    placeholder="-- Bấm để chọn môn học --"
                    onClick={() => {
                      if (!importBusy && !submitting) setExpandSubject((p) => !p);
                    }}
                    className="w-full py-2.5 px-4 rounded-lg border border-gray-300 text-base bg-white cursor-pointer"
                  />
                  <button
                    type="button"
                    aria-label="Mở hoặc thu gọn danh sách"
                    aria-expanded={expandSubject}
                    disabled={importBusy || submitting}
                    onClick={() => setExpandSubject((p) => !p)}
                    className="absolute right-3 top-3 border-0 bg-transparent cursor-pointer"
                  >
                    <ExpandButton
                      className={`text-2xl text-green-700 transition-transform duration-300 ${
                        expandSubject ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {/* Subject dropdown list */}
                <div
                  className={`overflow-y-auto bg-gray-100 rounded-lg transition-[max-height] duration-300 ease-in-out shadow-md ${
                    expandSubject ? "max-h-[200px]" : "max-h-0"
                  }`}
                >
                  {subjects
                    .filter((sub) => sub.availability !== false)
                    .map((subject) => (
                      <button
                        type="button"
                        key={subject._id}
                        className="w-full text-left py-2.5 px-4 text-base bg-white border-b border-gray-100 hover:bg-green-100 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedSubject(subject);
                          setConfirmed(false);
                          setExpandSubject(false);
                          setSelectedChapter(null);
                        }}
                      >
                        {subject.name}
                      </button>
                    ))}

                  {/* Other Subject Option */}
                  <button
                    type="button"
                    key="other-subject"
                    className="w-full text-left py-2.5 px-4 text-base bg-white font-medium text-green-700 hover:bg-green-100 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedSubject({ _id: null, name: "Khác (Môn học mới)" });
                      setConfirmed(false);
                      setExpandSubject(false);
                      setSelectedChapter(null);
                      setChapters([]);
                    }}
                  >
                    ➕ Khác (Môn học mới)
                  </button>
                </div>
              </div>

              {/* If "Other" Subject is selected */}
              {isOtherSubject && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-green-900">
                      Tên môn học gợi ý: <span className="text-red-500">*</span>
                    </label>
                    <input
                      aria-label="Tên môn học gợi ý"
                      type="text"
                      placeholder="Ví dụ: Trí tuệ nhân tạo..."
                      value={suggestedSubject}
                      disabled={importBusy || submitting}
                      onChange={(e) => { setSuggestedSubject(e.target.value); setConfirmed(false); }}
                      className="py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-green-900">
                      Tên chương gợi ý: <span className="text-red-500">*</span>
                    </label>
                    <input
                      aria-label="Tên chương gợi ý"
                      type="text"
                      placeholder="Ví dụ: Chương 1: Tìm kiếm đồ thị..."
                      value={suggestedChapter}
                      disabled={importBusy || submitting}
                      onChange={(e) => { setSuggestedChapter(e.target.value); setConfirmed(false); }}
                      className="py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Chapter Dropdown (for existing subject) */}
              {selectedSubject && selectedSubject._id !== null && (
                <div ref={chapterRef} className="flex flex-col gap-1.5">
                  <label className="font-semibold text-gray-700">
                    Chọn chương: <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      aria-label="Chọn chương..."
                      type="text"
                      readOnly
                      disabled={importBusy || submitting}
                      value={selectedChapter ? selectedChapter.name : ""}
                      placeholder="-- Bấm để chọn chương học --"
                      onClick={() => {
                        if (!importBusy && !submitting) setExpandChapter((p) => !p);
                      }}
                      className="w-full py-2.5 px-4 rounded-lg border border-gray-300 text-base bg-white cursor-pointer"
                    />
                    <button
                      type="button"
                      aria-label="Mở hoặc thu gọn danh sách"
                      aria-expanded={expandChapter}
                      disabled={importBusy || submitting}
                      onClick={() => setExpandChapter((p) => !p)}
                      className="absolute right-3 top-3 border-0 bg-transparent cursor-pointer"
                    >
                      <ExpandButton
                        className={`text-2xl text-green-700 transition-transform duration-300 ${
                          expandChapter ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>

                  {/* Chapter dropdown list */}
                  <div
                    className={`overflow-y-auto bg-gray-100 rounded-lg transition-[max-height] duration-300 ease-in-out shadow-md ${
                      expandChapter ? "max-h-[200px]" : "max-h-0"
                    }`}
                  >
                    {chapters
                      .filter((ch) => ch.availability !== false)
                      .map((chapter) => (
                        <button
                          type="button"
                          key={chapter._id}
                          className="w-full text-left py-2.5 px-4 text-base bg-white border-b border-gray-100 hover:bg-green-100 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedChapter(chapter);
                            setConfirmed(false);
                            setExpandChapter(false);
                          }}
                        >
                          {chapter.name}
                        </button>
                      ))}

                    {/* Other Chapter Option */}
                    <button
                      type="button"
                      key="other-chapter"
                      className="w-full text-left py-2.5 px-4 text-base bg-white font-medium text-green-700 hover:bg-green-100 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedChapter({ _id: null, name: "Khác (Chương mới)" });
                        setConfirmed(false);
                        setExpandChapter(false);
                      }}
                    >
                      ➕ Khác (Chương mới)
                    </button>
                  </div>
                </div>
              )}

              {/* If "Other" Chapter for existing subject is selected */}
              {selectedSubject && selectedSubject._id !== null && isOtherChapter && (
                <div className="flex flex-col gap-1.5 p-4 bg-green-50 rounded-lg border border-green-200">
                  <label className="text-sm font-semibold text-green-900">
                    Tên chương gợi ý mới: <span className="text-red-500">*</span>
                  </label>
                  <input
                    aria-label="Tên chương gợi ý mới"
                    type="text"
                    placeholder="Ví dụ: Chương 5: Thống kê nâng cao..."
                    value={suggestedChapter}
                    disabled={importBusy || submitting}
                    onChange={(e) => { setSuggestedChapter(e.target.value); setConfirmed(false); }}
                    className="py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white"
                  />
                </div>
              )}

              {/* Time limit */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-gray-700">
                  Thời gian làm bài (phút):
                </label>
                <input
                  aria-label="Thời gian làm bài (phút)"
                  type="number"
                  min={1}
                  max={300}
                  value={timeLimit}
                  disabled={importBusy || submitting}
                  onChange={(e) => { setTimeLimit(e.target.value); setConfirmed(false); }}
                  className="w-full sm:w-48 py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white"
                />
              </div>
            </fieldset>

            {/* Section 2: File Upload & AI Preview Action */}
            <div className="min-w-0 bg-gray-50 border-2 border-dashed border-green-500 rounded-xl p-4 sm:p-8 text-center flex flex-col items-center gap-4">
              <h2 className="text-2xl font-bold text-green-800">
                2. Tải Lên Tài Liệu Đề Thi (PDF hoặc CSV)
              </h2>

              <p className="text-sm text-gray-600 max-w-xl">
                Chọn file định dạng <strong>.pdf</strong> hoặc <strong>.csv</strong> (dung lượng tối đa 10MB, tối đa 200 câu hỏi).
              </p>

              {/* Disclosure Notice */}
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900 max-w-xl text-left leading-relaxed">
                ℹ️ <strong>Thông báo xử lý tài liệu AI:</strong> Nếu tải lên file PDF, tài liệu sẽ được gửi tới dịch vụ <strong>Google Gemini</strong> để trích xuất tự động văn bản câu hỏi và phương án. Hệ thống không lưu trữ hay xuất bản đề cho tới khi bạn xác nhận và gửi duyệt ở bước cuối cùng.
              </div>

              {/* File Input */}
              <div className="w-full min-w-0 flex flex-col sm:flex-row items-center gap-3 mt-2">
                <input
                  aria-label="Tải file PDF hoặc CSV đóng góp"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.pdf"
                  disabled={importBusy || submitting}
                  onChange={handleFileChange}
                  className="w-full min-w-0 bg-white border border-gray-300 rounded-lg p-2 text-sm cursor-pointer file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-green-100 file:text-green-800 hover:file:bg-green-200"
                />

                <button
                  type="button"
                  onClick={handleImportPreview}
                  disabled={!selectedFile || importBusy || submitting || contributionStats?.remaining === 0}
                  className="px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white font-semibold text-sm rounded-lg transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {importBusy ? "⏳ Đang trích xuất..." : "🔍 Trích xuất & Xem trước"}
                </button>
              </div>

              {selectedFile && (
                <p className="text-sm text-gray-700 font-medium">
                  📄 Đã chọn: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}

              {importStatus && (
                <p className={`text-sm mt-2 ${getStatusColor(importStatus)}`}>
                  {importStatus}
                </p>
              )}
            </div>

            {/* Section 3: Interactive Preview & Editor Component */}
            {previewData && (
              <ContributionPreview
                questions={previewData.questions}
                warnings={previewData.warnings}
                onChangeQuestion={handleUpdateQuestion}
                onDeleteQuestion={handleDeleteQuestion}
                onAddQuestion={handleAddQuestion}
                confirmed={confirmed}
                onToggleConfirm={setConfirmed}
                onSubmit={handleFinalSubmit}
                submitting={submitting}
                busy={importBusy}
                submitError={submitStatus}
                isMetadataValid={isMetadataValid}
                metadataError={metadataError}
              />
            )}

            {submitStatus && !previewData && (
              <div className={`p-4 rounded-xl border text-center ${getStatusColor(submitStatus)} bg-gray-50`}>
                {submitStatus}
              </div>
            )}

            {/* Format Instructions & CSV Template Guide */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 leading-relaxed text-gray-700 mt-4">
              <h3 className="text-xl font-bold text-green-700 mb-3">
                📖 Hướng Dẫn Định Dạng Tài Liệu
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-bold text-green-800 mb-2">📄 Đối với file PDF:</h4>
                  <ul className="list-disc list-inside space-y-1.5 text-gray-600">
                    <li>Hỗ trợ tài liệu PDF chứa văn bản hoặc hình ảnh scan rõ nét.</li>
                    <li>Nên bao gồm bảng đáp án ở cuối hoặc đánh dấu đáp án rõ ràng.</li>
                    <li>Các câu hỏi có hình ảnh/sơ đồ sẽ được mô tả kèm cảnh báo để bạn kiểm tra lại trước khi gửi.</li>
                    <li>Giới hạn: Tối đa <strong>10MB</strong> và tối đa <strong>200 câu hỏi</strong>.</li>
                  </ul>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-bold text-green-800 mb-2">📊 Đối với file CSV mẫu chuẩn:</h4>
                  <p className="text-gray-600 mb-2">
                    Mỗi câu chỉ hỗ trợ một đáp án đúng. Cột <code>answer</code> phải khớp nguyên văn một phương án; không ghép nhiều đáp án bằng dấu <code>;</code>.
                  </p>
                  <p className="text-gray-600 mb-2">
                    Các cột: <code>question, options, answer, explain</code> (mã hóa UTF-8, các phương án phân tách bởi dấu chấm phẩy <code>;</code>):
                  </p>
                  <pre className="bg-gray-100 p-2.5 rounded font-mono text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap">
{`"question","options","answer","explain"
"Thủ đô Việt Nam là gì?","Hà Nội;TP.HCM;Đà Nẵng;Huế","Hà Nội","Hà Nội là thủ đô của Việt Nam."`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
