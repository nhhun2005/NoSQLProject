import AccessibleDialog from "../AccessibleDialog";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import "./CreateQuizModal.css";
import stringValidater from "../../api/stringValidater";
import { MdExpandMore as ExpandButton } from "react-icons/md";
import { ImCross as ExitIcon } from "react-icons/im";
import DefaultAlert from "../AlertBoxes/DefaultAlert";
import chapterService from "../../services/chapterService";
import quizService from "../../services/quizService";
import questionImageService from "../../services/questionImageService";
import questionService from "../../services/questionService";
export default function CreateQuizModal({
  subjectId,
  showCreateQuiz,
  setShowCreateQuiz
}) {
  const questionsRefs = useRef([]);
  const [showAlert, setShowAlert] = useState(false);
  const [quizName, setQuizName] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [selectedChapter, setSelectedChapter] = useState(false);
  const [expandChapter, setExpandChapter] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [prevChapterName, setPrevChapterName] = useState("");
  const [questionCount, setQuestionCount] = useState(1);
  const [chapterDesc, setChapterDesc] = useState("");
  const [timeLimit, setTimeLimit] = useState(45);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const handleOnClickChapter = chapter => {
    setChapterName(chapter.name);
    setSelectedChapter(true);
  };
  useEffect(() => {
    chapterService.getBySubject(subjectId).then(res => {
      setChapters(res.data);
    }).catch(err => {
      console.log("Gap loi khi lay chapter: ", err);
    });
  }, [subjectId]);
  async function createQuiz() {
    if (pending.current) return;
    setError("");
    const questionList = questionsRefs.current.slice(0, questionCount).map(ref => ref?.getQuestionData());
    if (!quizName.trim() || !chapterName.trim() || !Number.isFinite(Number(timeLimit)) || Number(timeLimit) < 0) {
      setError('Vui lòng nhập tên đề, tên chương và thời gian không âm.');
      return;
    }
    if (!questionList.length || questionList.some(q => !q || !q.question.trim() || q.options.length < 2 || q.options.some(o => !o.trim()) || new Set(q.options.map(o => o.trim())).size !== q.options.length || !q.options.includes(q.answer) || q.type === 'image' && !q.imageURL.trim())) {
      setError('Mỗi câu hỏi cần nội dung, lựa chọn không trùng, đáp án đúng và ảnh nếu chọn dạng ảnh.');
      return;
    }
    pending.current = true;
    setSaving(true);
    try {
      // Tìm xem chapter đã tồn tại chưa
      let foundChapter = chapters.find(ch => ch.name === chapterName);
      let chapterId = null;
      if (foundChapter) {
        chapterId = foundChapter._id;
      } else {
        // Nếu chưa có, tạo mới
        const chapterRes = await chapterService.create({
          name: chapterName,
          subjectId: subjectId,
          order: chapters?.length,
          description: chapterDesc,
          availability: true
        });
        chapterId = chapterRes.data._id;

        // Cập nhật danh sách chapters để dropdown reflect chương mới
        setChapters(prev => [...prev, chapterRes.data]);
      }
      if (!chapterId) {
        console.error("Không thể tạo hoặc tìm thấy chapter");
        return;
      }
      const quizRes = await quizService.create({
        name: quizName,
        subjectId: subjectId,
        chapterId: chapterId,
        questionNum: questionCount,
        timeLimit: Number(timeLimit),
        availability: true
      });
      const quizId = quizRes.data._id;
      await Promise.all(questionList.map(q => {
        const payload = {
          quizId: quizId,
          question: q.question,
          options: q.options,
          explain: q.explain,
          answer: q.answer
        };
        if (q.type === "image") {
          payload.image = q.imageURL;
          return questionImageService.create(payload);
        } else {
          return questionService.create(payload);
        }
      }));
      setShowAlert(true);
      console.log("Tạo đề thành công");
    } catch (failure) {
      setError(failure.response?.data?.message || "Tạo đề chưa hoàn tất. Vui lòng kiểm tra dữ liệu trước khi thử lại.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  if (!showCreateQuiz) {
    return <></>;
  }
  return <AccessibleDialog label="Tạo bộ đề" onClose={() => {
    if (!saving) setShowCreateQuiz(false);
  }} className="absolute inset-0 bg-black/50 flex items-center justify-center z-9999 ">
      {error && <p role="alert" className="absolute top-4 bg-red-50 text-red-900 p-4 z-50">{error}</p>}
      {saving && <p role="status" className="absolute top-4 bg-white p-4 z-50">Đang tạo đề...</p>}
      <div className="relative w-[50%] h-[90%] bg-white rounded-[8px] shadow-black shadow-md pb-[96px] overflow-y-auto ">
        <div className="sticky top-0 right-0 flex justify-end p-4 bg-white z-10">
          <button type="button" aria-label="Đóng hộp thoại" onClick={() => {
          setShowCreateQuiz(false);
        }} className="border-0 bg-transparent p-1"><ExitIcon className="text-[24px] hover:scale-120 transtion-all duration-500"></ExitIcon></button>
        </div>
        <div className="flex flex-row gap-4 w-full items-center justify-center pt-2">
          <p className="px-8 w-[30%] text-2xl pt-8">Tên bộ đề: </p>
          <input aria-label="Tên bộ đề" type="text" className="flex-grow mr-8 text-2xl py-2 px-4 rounded-[8px]" value={quizName} onChange={e => setQuizName(() => {
          return e.target.value;
        })}></input>
        </div>
        <div className="flex flex-row gap-4 w-full items-center justify-center pt-2">
          <p className="px-8 w-[30%] text-2xl pt-8">Thời gian làm bài: </p>
          <input aria-label="Thời gian làm bài (phút)" type="number" className="flex-grow mr-8 text-2xl py-2 px-4 rounded-[8px]" value={timeLimit} onChange={e => setTimeLimit(() => {
          return e.target.value;
        })}></input>
        </div>
        <div className="flex flex-row gap-4 w-full items-center justify-center pt-2">
          <p className="px-8 w-[30%] text-2xl pt-8">Thuộc chương: </p>
          <div className="flex-grow">
            <input aria-label="Tên chương" type="text" className="w-[80%] mr-8 text-2xl py-2 px-4 rounded-[8px]" disabled={selectedChapter} value={chapterName} onChange={e => setChapterName(() => {
            return e.target.value;
          })}></input>
            <button type="button" aria-label="Mở hoặc thu gọn danh sách" aria-expanded={expandChapter} onClick={() => {
            setPrevChapterName(chapterName);
            setExpandChapter(prev => {
              if (prev) {
                setChapterName(prevChapterName);
                return !prev;
              }
              return !prev;
            });
            setSelectedChapter(false);
          }} className="border-0 bg-transparent p-1"><ExpandButton className={`text-4xl hover:scale-120 transition-alll duration-500 ${expandChapter && "rotate-180"}`}></ExpandButton></button>
          </div>
        </div>
        {!selectedChapter && <div className="flex flex-row gap-4 w-full items-center justify-center pt-2">
            <p className="px-8 w-[30%] text-2xl pt-8">Mô tả chương: </p>
            <input aria-label="Mô tả chương" type="text" className="flex-grow mr-8 text-2xl py-2 px-4 rounded-[8px]" value={chapterDesc} onChange={e => setChapterDesc(() => {
          return e.target.value;
        })}></input>
          </div>}
        <div className={`mt-4 mx-auto rounded-[8px] w-[90%] ${expandChapter ? "h-[348px]" : "h-0"} shadow-sm bg-gray-50 shadow-black transition-all duration-500 overflow-y-auto`}>
          {chapters?.map((chapter, i) => {
          if (chapter.availability == false) {
            return null;
          }
          return <button type="button" onClick={() => {
            handleOnClickChapter(chapter);
          }} key={`chapter_${i}`} className="transition-all duration-200 mt-4 hover:bg-[#75b971] text-gray-700 hover:text-white flex items-center pt-4 mx-auto w-[95%]  rounded-[8px] bg-white shadow-sm shadow-gray-700 px-4 ">
                <p className="text-2xl   ">{chapter.name}</p>
              </button>;
        })}
        </div>

        {Array.from({
        length: questionCount
      }).map((_, i) => {
        return <NewQuestion key={`question_${i}`} ref={element => questionsRefs.current[i] = element} index={i}></NewQuestion>;
      })}

        <button type="button" onClick={() => {
        setQuestionCount(prev => prev + 1);
      }} className=" absolute right-8  mt-4 text-white bg-[#3D763A] px-4 py-2 rounded-[8px] ">
          Thêm câu hỏi
        </button>

        <div className="w-1 h-[2rem] "></div>
        <button type="button" onClick={() => {
        createQuiz();
      }} className="absolute my-14  right-8 text-white bg-[#3D763A] px-8 py-2 rounded-[8px] ">
          Tạo đề
        </button>
        <div className="w-1 h-[2rem] "></div>
      </div>

      {showAlert && <DefaultAlert title="Tạo đề thành công" information="Đã tạo đề thành công, hãy nhấn đóng để về trang quản lý" closeButton={() => {
      window.location.reload();
      setShowAlert(false);
    }}></DefaultAlert>}
    </AccessibleDialog>;
}
const NewQuestion = forwardRef((props, ref) => {
  const [type, setType] = useState("text");
  const {
    index
  } = props;
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [explain, setExplain] = useState("");
  const [imageURL, setImageURL] = useState("");
  const [showImageURL, setShowImageURL] = useState(false);
  useEffect(() => {
    const currentAnswerIsValid = answer && options.includes(answer);
    if (!currentAnswerIsValid) {
      const firstValidOption = options.find(opt => opt && opt.trim() !== "") || "";
      setAnswer(firstValidOption);
    }
  }, [options, answer]);
  useImperativeHandle(ref, () => ({
    getQuestionData: () => ({
      type,
      question,
      options,
      explain,
      imageURL,
      answer
    })
  }));
  return <div className="relative mt-4 mx-auto w-[90%] h-[300px] px-4  border-1 rounded-[8px] flex-col overflow-y-auto pb-4">
      <div className="flex flex-row mt-4 items-center ">
        <p className="w-[30%] text-[1rem] pt-4 ">Đây là câu hỏi dạng ảnh? </p>
        <input aria-label="Đây là câu hỏi dạng ảnh?" onClick={() => {
        setShowImageURL(prev => {
          if (!prev) {
            setType("image");
          } else if (prev) {
            setType("text");
            setImageURL("");
          }
          return !prev;
        });
      }} type="checkbox" className="w-[2rem] h-[2rem] "></input>
      </div>
      {showImageURL && <>
          <div className="flex flex-row mt-4 items-center ">
            <p className="w-[15%] text-[1rem] pt-4 ">URL của ảnh: </p>
            <input aria-label="Đường dẫn ảnh" onChange={e => setImageURL(() => {
          return e.target.value;
        })} type="text" value={imageURL} className="flex-grow px-4 py-2 rounded-[8px] "></input>
          </div>
        </>}

      <div className="flex flex-row mt-4 items-center ">
        <p className="w-[15%] text-[1rem] pt-4 ">Câu hỏi {index + 1}: </p>
        <input aria-label="Nội dung câu hỏi" onChange={e => setQuestion(() => {
        return e.target.value;
      })} type="text" value={question} className="flex-grow px-4 py-2 rounded-[8px] "></input>
      </div>
      {options.map((option, index) => {
      return <div key={`option_${index}`} className="flex flex-row mt-4 items-center ">
            <p className="w-[15%] text-[1rem] pt-4 ">Lựa chọn {index + 1}: </p>
            <input aria-label="Lựa chọn trả lời" onChange={e => setOptions(prev => {
          const newOptions = [...prev];
          if (stringValidater(e.target.value, 2)) newOptions[index] = e.target.value;
          return newOptions;
        })} type="text" value={option} className="flex-grow px-4 py-2 rounded-[8px] "></input>
          </div>;
    })}

      <div className=" absolute right-4 flex flex-row gap-4">
        <button type="button" onClick={() => {
        setOptions(prev => {
          const newOptions = [...prev, ""];
          return newOptions;
        });
      }} className="mt-4 text-white bg-[#3D763A] px-4 py-2 rounded-[8px] ">
          Thêm lựa chọn
        </button>
      </div>
      <div className="h-[4rem] w-1"></div>
      <div className="flex flex-row mt-4 items-center ">
        <p className="w-[15%] text-[1rem] pt-4 ">Chọn đáp án: </p>
        <select aria-label="Đáp án đúng" value={answer} onChange={e => setAnswer(e.target.value)} name="optionsList" className="flex-grow max-w-[85%] bg-white px-4 py-2 rounded-[8px]">
          {options.map((option, index) => {
          return <option key={`option_select_${index}`} value={option}>
                {option}
              </option>;
        })}
        </select>
      </div>

      <div className="flex flex-row mt-4 items-center ">
        <p className="w-[15%] text-[1rem] pt-4 ">Giải thích: </p>
        <input aria-label="Giải thích" onChange={e => setExplain(() => {
        return e.target.value;
      })} type="text" value={explain} className="flex-grow px-4 py-2 rounded-[8px] "></input>
      </div>
    </div>;
});
