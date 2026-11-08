import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import quizService from '../../services/quizService';
import submissionService from '../../services/submissionService';
import QuestionDrawer from '../../components/QuestionDrawer/QuestionDrawer';
import { resolveAssetUrl } from '../../utils/apiConfig';
const defaults = {
  shuffleQuestions: true,
  showAnswers: true,
  shuffleOptions: false,
  rotationalPractice: true,
  timeLimit: false,
  scoreMode: false
};
function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export default function QuizPage() {
  const {
    quizId
  } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const options = useMemo(() => ({
    ...defaults,
    ...location.state?.options
  }), [location.state?.options]);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  const [retryLoad, setRetryLoad] = useState(0);
  const [mode, setMode] = useState(Boolean(options.scoreMode));
  const [activeOptions, setActiveOptions] = useState(options);
  const [remaining, setRemaining] = useState(null);
  const [result, setResult] = useState(null);
  const attemptRef = useRef(null);
  const deadlineRef = useRef(null);
  const sendingRef = useRef(false);
  const startedRef = useRef(null);
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const autoSubmitted = useRef(false);
  const initialize = useCallback(async (scoreMode, selectedOptions = options) => {
    const generation = generationRef.current;
    autoSubmitted.current = false;
    setPhase('starting');
    setError('');
    try {
      const response = await quizService.startAttempt(quizId, scoreMode);
      if (!mountedRef.current || generationRef.current !== generation) return;
      const data = response.data;
      const actualOptions = scoreMode ? {
        ...selectedOptions,
        scoreMode: true,
        showAnswers: false,
        rotationalPractice: false,
        timeLimit: true
      } : {
        ...selectedOptions,
        scoreMode: false
      };
      let list = data.quiz?.questions || [];
      if (!list.length) throw new Error('Bộ đề chưa có câu hỏi.');
      list = actualOptions.shuffleQuestions ? shuffled(list) : list;
      if (actualOptions.shuffleOptions) list = list.map(q => ({
        ...q,
        options: shuffled(q.options)
      }));
      setQuiz(data.quiz);
      setQuestions(list);
      setAnswers({});
      setFlagged([]);
      setIndex(0);
      setResult(null);
      setActiveOptions(actualOptions);
      attemptRef.current = data.attemptId;
      const minutes = Number(data.quiz.timeLimit);
      // The server enforces its own deadline. The client timer is display/auto-submit only.
      deadlineRef.current = actualOptions.timeLimit && minutes > 0 ? scoreMode && data.deadlineAt ? new Date(data.deadlineAt).getTime() : Date.now() + minutes * 60000 : null;
      setRemaining(deadlineRef.current ? Math.ceil((deadlineRef.current - Date.now()) / 1000) : null);
      setPhase('running');
    } catch (failure) {
      if (mountedRef.current && generationRef.current === generation) {
        setError(failure.response?.data?.message || failure.message || 'Không thể bắt đầu bài.');
        setPhase('ready');
      }
    }
  }, [options, quizId]);
  useEffect(() => {
    mountedRef.current = true;
    generationRef.current++;
    let current = true;
    setPhase('loading');
    setError('');
    setQuiz(null);
    setQuestions([]);
    quizService.getById(quizId).then(async response => {
      if (!current) return;
      setQuiz(response.data);
      setPhase('ready');
      if (location.state?.options && startedRef.current !== location.key) {
        startedRef.current = location.key;
        await initialize(Boolean(options.scoreMode));
      }
    }).catch(failure => {
      if (current) {
        setError(failure.response?.data?.message || 'Không tải được bộ đề. Kiểm tra kết nối rồi thử lại.');
        setPhase('error');
      }
    });
    return () => {
      current = false;
      mountedRef.current = false;
    };
  }, [quizId, retryLoad, location.key, location.state?.options, options.scoreMode, initialize]);
  const submit = useCallback(async () => {
    if (sendingRef.current || phase !== 'running' || !questions.length) return;
    sendingRef.current = true;
    setPhase('submitting');
    setError('');
    try {
      if (activeOptions.scoreMode) {
        const response = await submissionService.createOrUpdate({
          quizId,
          attemptId: attemptRef.current,
          answers: Object.entries(answers).map(([questionId, selectedOption]) => ({
            questionId,
            selectedOption
          }))
        });
        if (!mountedRef.current) return;
        // Score and correctness are computed exclusively on the server.
        setResult(response.data.submission);
        setPhase('submitted');
      } else {
        const correct = questions.filter(q => answers[q._id] === q.answer).length;
        setResult({
          score: Math.round(correct / questions.length * 100),
          correct,
          totalQuestions: questions.length
        });
        setPhase('submitted');
      }
    } catch (failure) {
      if (mountedRef.current) {
        setError(failure.response?.data?.message || 'Chưa lưu được bài. Bạn có thể bấm Nộp bài để thử lại.');
        setPhase([404, 410].includes(failure.response?.status) ? 'ready' : 'running');
      }
    } finally {
      sendingRef.current = false;
    }
  }, [phase, questions, activeOptions.scoreMode, quizId, answers]);
  useEffect(() => {
    if (phase !== 'running' || !deadlineRef.current) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    if (phase === 'running' && remaining === 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit();
    }
  }, [phase, remaining, submit]);
  function retryIncorrect() {
    const list = questions.filter(q => answers[q._id] !== q.answer);
    if (!list.length) {
      navigate(back);
      return;
    }
    setQuestions(list);
    setAnswers({});
    setFlagged([]);
    setIndex(0);
    setResult(null);
    setError('');
    deadlineRef.current = null;
    setRemaining(null);
    setPhase('running');
    autoSubmitted.current = false;
  }
  const subjectId = typeof quiz?.subjectId === 'object' ? quiz?.subjectId?._id : quiz?.subjectId;
  const back = subjectId ? `/subject/view/${subjectId}` : '/subject/view';
  if (phase === 'loading' || phase === 'starting') return <p className="p-8" role="status">{phase === 'starting' ? 'Đang chuẩn bị bài...' : 'Đang tải bộ đề...'}</p>;
  if (phase === 'error') return <section className="p-8" role="alert"><p>{error}</p><button type="button" onClick={() => setRetryLoad(v => v + 1)}>Thử lại</button> <Link to="/subject/view">Về môn học</Link></section>;
  if (phase === 'ready') return <section className="max-w-3xl mx-auto p-8"><Link to={back}>← Về môn học</Link><h1 className="mt-6">{quiz?.name || 'Bộ đề'}</h1>{!quiz?.questions?.length ? <p>Bộ đề chưa có câu hỏi để làm.</p> : <><p>Chọn luyện tập để xem lời giải, hoặc làm bài có tính điểm để lưu kết quả.</p><label className="block my-4"><input type="checkbox" checked={mode} onChange={e => setMode(e.target.checked)} /> Làm bài có tính điểm ({Number(quiz?.timeLimit) || 0} phút)</label><button type="button" onClick={() => {
        autoSubmitted.current = false;
        initialize(mode);
      }} className="bg-green-800 text-white rounded-lg px-6 py-3">Bắt đầu làm bài</button></>}{error && <p role="alert" className="text-red-800 mt-4">{error}</p>}</section>;
  const question = questions[index];
  if (!question) return <section className="p-8"><p>Không có câu hỏi để hiển thị.</p><Link to={back}>Về môn học</Link></section>;
  const locked = phase !== 'running';
  return <div className="h-full bg-gray-50 overflow-y-auto">
    <section className="w-full max-w-3xl mx-auto p-4 pt-8 pb-[40vh]">
      <Link to={back}>← Về môn học</Link><h1 className="text-2xl my-4">{quiz.name}</h1>
      {error && <div role="alert" className="p-4 border border-red-600 bg-red-50 text-red-900 mb-4">{error}</div>}
      {phase === 'submitting' && <p role="status">Đang nộp bài...</p>}
      {phase === 'submitted' && <div role="status" className="p-4 bg-green-100 text-green-950 mb-6"><p>{activeOptions.scoreMode ? 'Đã lưu bài. Điểm do hệ thống chấm' : 'Kết quả luyện tập (không lưu điểm)'}: <strong>{result.score}%</strong></p>{activeOptions.scoreMode && <Link to={`/quizzes/review/${quizId}`} state={{
          subjectId,
          mode: 'latest'
        }}>Xem lại bài và lời giải →</Link>}</div>}
      <div className="flex justify-between items-center gap-3 mb-5"><button type="button" disabled={index === 0} onClick={() => setIndex(v => v - 1)}>← Câu trước</button><span>Câu {index + 1}/{questions.length}</span><button type="button" disabled={index === questions.length - 1} onClick={() => setIndex(v => v + 1)}>Câu sau →</button><button type="button" aria-label={flagged.includes(question._id) ? 'Bỏ đánh dấu câu hỏi' : 'Đánh dấu câu hỏi'} aria-pressed={flagged.includes(question._id)} onClick={() => setFlagged(v => v.includes(question._id) ? v.filter(id => id !== question._id) : [...v, question._id])}>🚩</button></div>
      <fieldset disabled={locked}><legend className="text-2xl font-bold mb-4">{index + 1}. {question.question}</legend>
      {question.image && <img src={resolveAssetUrl(question.image)} alt={`Hình minh họa câu ${index + 1}`} className="max-w-full max-h-[400px] mx-auto mb-6 object-contain" onError={e => {
          e.currentTarget.alt = 'Không tải được hình minh họa. Vui lòng kiểm tra đường dẫn ảnh.';
        }} />}
      <div className="flex flex-col gap-4">{question.options.map((option, i) => {
            const selected = answers[question._id] === option;
            const reveal = !activeOptions.scoreMode && (phase === 'submitted' || activeOptions.showAnswers && answers[question._id]);
            const correct = reveal && option === question.answer;
            const wrong = reveal && selected && !correct;
            return <label key={`${question._id}-${i}`} className={`flex gap-3 p-4 border rounded-xl ${correct ? 'bg-green-100 border-green-700' : wrong ? 'bg-red-100 border-red-700' : selected ? 'bg-gray-200 border-gray-600' : 'bg-white border-gray-300'}`}><input type="radio" name={question._id} checked={selected} value={option} disabled={locked || Boolean(!activeOptions.scoreMode && activeOptions.showAnswers && answers[question._id])} onChange={() => setAnswers(v => ({
                ...v,
                [question._id]: option
              }))} /><span>{option}{correct && ' — Đáp án đúng'}{wrong && ' — Chưa đúng'}</span></label>;
          })}</div></fieldset>
      {!activeOptions.scoreMode && (phase === 'submitted' || activeOptions.showAnswers && answers[question._id]) && <div className="mt-6 p-4 rounded-xl bg-green-50"><p><strong>Đáp án đúng:</strong> {question.answer}</p><p>{question.explain || 'Câu hỏi chưa có phần giải thích.'}</p></div>}
    </section>
    <QuestionDrawer totalQuestions={questions.length} answered={questions.flatMap((q, i) => answers[q._id] ? [i + 1] : [])} flagged={questions.flatMap((q, i) => flagged.includes(q._id) ? [i + 1] : [])} currentQuestion={index + 1} onSelectQuestion={num => setIndex(num - 1)} remainingTime={remaining === null ? 'Không giới hạn' : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`} rotationalPractice={false} onSubmit={submit} submitDisabled={locked} onRetry={retryIncorrect} showRetryButton={!activeOptions.scoreMode && phase === 'submitted' && activeOptions.rotationalPractice} />
  </div>;
}
