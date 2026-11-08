import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./QuizListPage.css";
import ModalOptionQuiz from "../../components/ModalOptionQuiz/ModalOptionQuiz";
import UserStats from "../../components/UserStats/UserStats";
import { MdExpandMore as ExpandButton } from "react-icons/md";
import CreateQuizModal from "../../components/CreateQuizModal/CreateQuizModal";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import { useSelector } from "react-redux";
import ConfirmAlert from "../../components/AlertBoxes/ConfirmAlert";
import DefaultAlert from "../../components/AlertBoxes/DefaultAlert";
import subjectService from "../../services/subjectService";
import chapterService from "../../services/chapterService";
import quizService from "../../services/quizService";
import submissionService from "../../services/submissionService";
import CreateChapterModal from "../../components/CreateChapterModal/CreateChapterModal";
export default function QuizListPage() {
  const {
    subjectId
  } = useParams();
  const navigate = useNavigate();
  const [subject, setSubject] = useState();
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  // Modal trạng thái
  const [showModal, setShowModal] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [showCreateChapter, setShowCreateChapter] = useState(false);

  // Confirm modal (review)
  const [showConfirm, setShowConfirm] = useState(false);
  const [quizToReview, setQuizToReview] = useState(null);

  // Redux
  const account = useSelector(state => state.user.account);
  const role = account?.role || "User";
  const isAdmin = role === "Admin";

  // Xác định chế độ hiển thị: edit cho admin, view cho user

  const mode = useSelector(state => state.viewMode.mode);
  const type = isAdmin && mode === "edit" ? "edit" : "view";
  // --- HANDLERS ---
  const handleCreateNewChapter = () => {
    setShowCreateChapter(true);
  };
  const handleCreateNewQuiz = () => setShowCreateQuiz(true);
  const handleOpenModal = quiz => {
    setSelectedQuiz(quiz);
    setShowModal(true);
  };
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedQuiz(null);
  };
  const handleStartQuiz = (options, subjectId) => {
    if (!selectedQuiz) return;
    setShowModal(false);
    navigate(`/quizzes/${selectedQuiz._id}`, {
      state: {
        quiz: selectedQuiz,
        options: options,
        subjectId
      }
    });
  };
  const handleReviewQuiz = quiz => {
    if (!quiz) return;
    setQuizToReview(quiz);
    setShowConfirm(true);
  };
  const handleYes = () => {
    if (!quizToReview) return;
    setShowConfirm(false);
    navigate(`/quizzes/review/${quizToReview._id}`, {
      state: {
        mode: "latest",
        subjectId
      }
    });
  };
  const handleNo = () => {
    if (!quizToReview) return;
    setShowConfirm(false);
    navigate(`/quizzes/review/${quizToReview._id}`, {
      state: {
        mode: "full",
        subjectId
      }
    });
  };
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setSubject(null);
    setChapters([]);
    Promise.all([subjectService.getById(subjectId), chapterService.getBySubject(subjectId), quizService.getBySubject(subjectId)]).then(([subjectRes, chapterRes, quizRes]) => {
      if (!current) return;
      setSubject(subjectRes.data);
      setChapters(chapterRes.data.map(chapter => ({
        ...chapter,
        quizzes: quizRes.data.filter(quiz => String(quiz.chapterId?._id || quiz.chapterId) === String(chapter._id))
      })));
    }).catch(failure => {
      if (current) setError(failure.response?.data?.message || 'Không tải được nội dung môn học.');
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [subjectId, retry]);

  // --- RENDER ---
  if (loading) return <p role="status" className="p-6 text-lg">Đang tải dữ liệu...</p>;
  if (error) return <section role="alert" className="p-6"><p>{error}</p><button type="button" onClick={() => setRetry(v => v + 1)}>Thử lại</button></section>;
  if (!subject) return <p className="p-6">Không tìm thấy môn học.</p>;
  return <div className="w-full pb-24 bg-white">
      {type === "edit" && <p className="px-14 text-4xl font-bold pt-4 text-gray-600">
          Quản lý môn học
        </p>}
      <p className={`text-4xl font-black px-14 ${type !== "edit" ? "pt-14" : "pt-2"} text-[#3D763A]`}>
        {subject?.name || "Đang tải môn học..."}
      </p>

      {type === "edit" && <div className="flex flex-row justify-between">
          <p className="px-18 text-2xl text-gray-600">Danh sách bộ đề sẵn có</p>
          <div className="flex flex-row">
            <button type="button" className="mr-4 bg-[#31872D] px-6 py-4 text-white flex items-center justify-center rounded-2xl cursor-pointer select-none shadow-sm shadow-black hover:scale-105 transition-all duration-500" onClick={handleCreateNewChapter}>
              Thêm chương
            </button>
            <button type="button" className="mr-24 bg-[#31872D] px-6 py-4 text-white flex items-center justify-center rounded-2xl cursor-pointer select-none shadow-sm shadow-black hover:scale-105 transition-all duration-500" onClick={handleCreateNewQuiz}>
              Tạo đề
            </button>
          </div>
        </div>}

      {type !== "edit" && chapters.length > 0 && <div id="phantichdulieu" className="mt-4 p-10 rounded-[8px] border-1 w-[90%] min-h-[250px] h-[40%] mx-auto">
          <UserStats subjectId={subjectId} userId={account?.id} // Redux user ID
      chapters={chapters.filter(item => {
        return item.availability;
      })} // chapters đã kèm quizzes
      />
        </div>}

      {!chapters.some(chapter => type === "edit" || chapter.availability) && <p className="px-14 py-6">Môn học chưa có chương hoặc bộ đề được công khai.</p>}
      {chapters?.map(chapter => {
      if (!chapter.availability && type == "view") {
        return null;
      } else if (type === "edit" || chapter.availability) {
        return <ChapterBox key={chapter._id} chapter={chapter} setSelectedQuiz={handleOpenModal} setShowModal={setShowModal} onReview={handleReviewQuiz} type={type} />;
      }
    })}

      <ModalOptionQuiz show={showModal} quiz={selectedQuiz} onClose={handleCloseModal} onStart={handleStartQuiz} subjectId={subjectId} />

      <CreateQuizModal subjectId={subjectId} showCreateQuiz={showCreateQuiz} setShowCreateQuiz={setShowCreateQuiz} />
      <CreateChapterModal setShowConfirm={setShowConfirm} subjectId={subjectId} showCreateChapter={showCreateChapter} setShowCreateChapter={setShowCreateChapter}></CreateChapterModal>

      <ConfirmModal show={showConfirm} onClose={() => setShowConfirm(false)} title="Xem lại bài" message="Bạn muốn xem lại lần làm bài gần nhất hay toàn bộ câu hỏi?" yesText="Lần gần nhất" noText="Xem toàn bộ câu hỏi" onYes={handleYes} onNo={handleNo} />
    </div>;
}

// ---------------- CHAPTER BOX ----------------
function ChapterBox({
  chapter,
  setSelectedQuiz,
  onReview,
  type
}) {
  const [showConfirm, setShowConfirm] = useState(0);
  const [expandChapterBox, setExpandChapterBox] = useState(false);
  const handleOpenModal = quiz => {
    setSelectedQuiz(quiz);
  };
  async function handleDeleteChapter() {
    chapterService.updateAvailability(chapter._id, {
      availability: !chapter.availability
    }).then(() => {
      setShowConfirm(2);
    }).catch(() => {
      setShowConfirm(3);
    });
  }
  return <div className="relative p mt-8 mx-auto w-[90%] pb-16 transition-all duration-500 shadow-black shadow-sm rounded-[8px]">
      <div className="flex flex-row justify-between">
        <p className="text-4xl pt-4 px-8 text-[#3D763A]">{chapter.name}</p>
        <button type="button" aria-label={`${expandChapterBox ? "Thu gọn" : "Mở"} chương ${chapter.name}`} aria-expanded={expandChapterBox} onClick={() => setExpandChapterBox(v => !v)}><ExpandButton aria-hidden="true" className={`text-4xl hover:scale-110 transition-all duration-500 ${expandChapterBox ? "rotate-180" : ""}`} /></button>
      </div>
      <div hidden={!expandChapterBox} className={`${expandChapterBox ? "h-[312px]" : "h-0"} transition-all duration-500 overflow-hidden`}>
        <div className="w-full h-full pb-8 overflow-scroll">
          {!chapter.quizzes.some(quiz => type === "edit" || quiz.availability) && <p className="p-8">Chương này chưa có bộ đề được công khai.</p>}
          {chapter.quizzes.map(quiz => {
          if (!quiz.availability && type == "view") {
            return null;
          } else if (type == "edit" || quiz.availability) {
            return <QuizBox key={quiz._id} quiz={quiz} onOpenModal={handleOpenModal} onReview={onReview} type={type} />;
          }
        })}
        </div>
      </div>
      {type == "edit" && <button onClick={() => {
      setShowConfirm(1);
    }} className={`absolute right-8 ${chapter.availability ? "bg-red-500" : "bg-[#31872D]"}  text-white border-none px-6 py-2 shadow-black shadow-sm rounded-xl  hover:scale-105 transition-all duration-400`}>
          {chapter.availability ? "Ẩn chương" : "Hiện chương"}
        </button>}
      {showConfirm == 2 && <DefaultAlert title="Thay đổi chương thành công" information="Đã thay đổi thành công trạng thái của chương!" closeButton={() => {
      window.location.reload();
    }}></DefaultAlert>}
      {showConfirm == 3 && <DefaultAlert title="Thay đổi chương thất bại" information="Không thể thay đổi trạng thái của này, hãy thử lại sau" closeButton={() => {
      setShowConfirm(0);
    }}></DefaultAlert>}
      {showConfirm == 1 && <ConfirmAlert confirmButton={() => {
      handleDeleteChapter();
    }} title="Thay đổi chương" information={`Bạn có chắc chắc muốn thay đổi trạng thái của chương "${chapter.name}" không?`} isNegative={true} closeButton={() => {
      setShowConfirm(0);
    }}></ConfirmAlert>}
    </div>;
}

// ---------------- QUIZ BOX ----------------
function QuizBox({
  quiz,
  onOpenModal,
  onReview,
  type
}) {
  const [bestScore, setBestScore] = useState(null);
  const [scoreState, setScoreState] = useState('loading');
  const [scoreRetry, setScoreRetry] = useState(0);
  const id = useSelector(state => state.user.account.id);
  const navigate = useNavigate();
  useEffect(() => {
    let current = true;
    if (type === 'edit') return;
    setScoreState('loading');
    setBestScore(null);
    submissionService.getBest(quiz._id, id).then(res => {
      if (current) {
        setBestScore(typeof res.data?.bestScore === 'number' ? res.data.bestScore : null);
        setScoreState('done');
      }
    }).catch(() => {
      if (current) setScoreState('error');
    });
    return () => {
      current = false;
    };
  }, [id, quiz._id, type, scoreRetry]);
  async function handleDeleteQuiz() {
    try {
      await quizService.updateAvailability(quiz._id, {
        availability: !quiz.availability
      });
      setShowConfirm(2);
    } catch {
      setShowConfirm(3);
    }
  }
  const [showConfirm, setShowConfirm] = useState(0);
  return <div className="mt-4 rounded-[8px] border border-gray-300 w-[95%] pt-4 pb-2 px-8 mx-auto grid grid-cols-3 items-center hover:shadow-md transition-all">
      <div>
        <p className="w-full text-[24px] text-gray-700 font-light">
          {quiz.name}
        </p>
      </div>
      {type != "edit" && <div className="relative w-full h-[2rem] bg-gray-200 rounded-4 overflow-hidden">
          <div className="h-full bg-green-500 transition-all duration-500" style={{
        width: `${Math.max(0, Math.min(100, bestScore ?? 0))}%`
      }}>
            <p className="absolute w-full text-center text-gray-700 text-2xl">
              {scoreState === "loading" ? "Đang tải điểm..." : scoreState === "error" ? <button type="button" onClick={() => setScoreRetry(v => v + 1)}>Thử tải lại điểm</button> : bestScore === null ? "Chưa làm bài" : `Cao nhất: ${bestScore}/100`}
            </p>
          </div>
        </div>}
      <div className={`flex gap-3 justify-self-end ${type == "edit" ? "col-span-2" : ""}`}>
        {type === "view" && <>
            <button className="border border-[#3D763A] text-[#3D763A] px-6 py-2 rounded-xl hover:bg-[#E6F4E6] transition-all" onClick={() => onReview(quiz)}>
              Xem lại
            </button>
            <button className="bg-[#31872D] text-white px-6 py-2 rounded-xl hover:bg-[#31612F] transition-all" onClick={() => onOpenModal(quiz)}>
              Làm bài
            </button>
          </>}
        {type === "edit" && <>
            <button onClick={() => {
          setShowConfirm(1);
        }} className={`${quiz.availability ? "bg-red-500" : "bg-[#31872D] "} text-white border-none px-6 py-2 shadow-black shadow-sm rounded-xl  hover:scale-105 transition-all duration-400`}>
              {quiz.availability ? "Ẩn bài" : "Hiện bài"}
            </button>
            <button className="text-[#3D763A] bg-white border-none px-6 py-2 shadow-black shadow-sm rounded-xl  hover:scale-105 transition-all duration-400" onClick={() => {
          navigate(`/subject/${type}/quiz/${quiz._id}`);
        }}>
              Chỉnh sửa
            </button>
          </>}
      </div>
      {showConfirm == 2 && <DefaultAlert title="Thay đổi bộ đề thành công" information="Đã thay đổi thành công trạng thái của bộ đề!" closeButton={() => {
      window.location.reload();
    }}></DefaultAlert>}
      {showConfirm == 3 && <DefaultAlert title="Thay đổi thất bại" information="Không thể thay đổi bộ đề này, hãy thử lại sau" closeButton={() => {
      setShowConfirm(0);
    }}></DefaultAlert>}
      {showConfirm == 1 && <ConfirmAlert confirmButton={() => {
      handleDeleteQuiz();
    }} title="Thay đổi bộ đề" information={`Bạn có chắc chắc muốn thay đổi trạng thái của "${quiz.name}" không?`} isNegative={true} closeButton={() => {
      setShowConfirm(0);
    }}></ConfirmAlert>}
    </div>;
}
