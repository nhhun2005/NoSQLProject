import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import quizService from '../../services/quizService';
import submissionService from '../../services/submissionService';
import ReviewDrawer from '../../components/ReviewDrawer/ReviewDrawer';
import { resolveAssetUrl } from '../../utils/apiConfig';
export default function ReviewQuizPage() {
  const {
    quizId
  } = useParams();
  const location = useLocation();
  const userId = useSelector(state => state.user.account?.id);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setData(null);
    Promise.all([quizService.getReview(quizId), submissionService.getLatest(quizId, userId)]).then(([quiz, submission]) => {
      if (current) setData({
        quiz: quiz.data,
        submission: submission.data
      });
    }).catch(failure => {
      if (current) setError(failure.response?.data?.message || 'Không tải được bài làm. Kiểm tra kết nối rồi thử lại.');
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [quizId, userId, retry]);
  if (loading) return <p role="status" className="p-8">Đang tải bài làm...</p>;
  if (error) return <section role="alert" className="p-8"><h1>Chưa thể xem lại bộ đề</h1><p>{error}</p><button type="button" className="app-button" onClick={() => setRetry(v => v + 1)}>Thử lại</button> <Link to={`/quizzes/${quizId}`}>Mở bộ đề để luyện tập / làm bài</Link> <Link to="/subject/view">Về môn học</Link></section>;
  if (!data?.quiz) return <p className="p-8">Không tìm thấy bộ đề. <Link to="/subject/view">Về môn học</Link></p>;
  const {
    quiz,
    submission
  } = data;
  const subjectId = typeof quiz.subjectId === 'object' ? quiz.subjectId?._id : quiz.subjectId;
  const userAnswers = Object.fromEntries((submission?.answers || []).map(a => [String(a.questionId), a.selectedOption]));
  const showSelection = location.state?.mode !== 'full';
  return <section className="w-1/2 mx-auto p-8 bg-gray-50 min-h-screen">
    <h1 className="text-3xl font-bold text-center mb-6">Xem lại: {quiz.name}</h1>
    {submission ? <div className="bg-white border rounded-xl p-5 mb-8"><p>Điểm lần gần nhất: <strong>{submission.score}%</strong></p><p>Điểm cao nhất: <strong>{submission.bestScore}%</strong></p><p>Thời gian làm: {Math.floor(submission.timeSpent / 60)} phút {submission.timeSpent % 60} giây</p></div> : <p>Chưa có bài làm có tính điểm được lưu.</p>}
    {!quiz.questions?.length && <p>Bộ đề chưa có câu hỏi.</p>}
    {(quiz.questions || []).map((q, index) => <article key={q._id} id={`question-${index + 1}`} className="bg-white p-6 mb-8 rounded-xl scroll-mt-8">
      <h2 className="text-xl font-semibold">{index + 1}. {q.question}</h2>
      {q.image && <img src={resolveAssetUrl(q.image)} alt={`Hình minh họa câu ${index + 1}`} className="max-w-full max-h-[400px] object-contain my-4" />}
      <ul className="list-none space-y-3 my-4">{q.options.map((option, i) => <li key={i} className={`p-4 rounded-lg border ${option === q.answer ? 'bg-green-100 border-green-700' : showSelection && option === userAnswers[q._id] ? 'bg-red-100 border-red-700' : 'border-gray-300'}`}>{String.fromCharCode(65 + i)}. {option}{option === q.answer && ' — Đáp án đúng'}{showSelection && option === userAnswers[q._id] && ' — Bạn đã chọn'}</li>)}</ul>
      <p><strong>Giải thích:</strong> {q.explain || 'Chưa có phần giải thích.'}</p>
    </article>)}
    <Link to={subjectId ? `/subject/view/${subjectId}` : '/subject/view'} className="inline-block px-6 py-3 bg-green-800 text-white rounded-lg">Hoàn tất việc xem lại</Link>
    <ReviewDrawer totalQuestions={quiz.questions?.length || 0} />
  </section>;
}
