import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import quizService from '../../services/quizService';
import chapterService from '../../services/chapterService';
import { resolveAssetUrl } from '../../utils/apiConfig';
export default function EditQuizPage() {
  const {
      id
    } = useParams(),
    navigate = useNavigate();
  const [quiz, setQuiz] = useState(null),
    [questions, setQuestions] = useState([]),
    [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setQuiz(null);
    quizService.getById(id).then(async res => {
      const subject = res.data.subjectId?._id || res.data.subjectId;
      const response = await chapterService.getBySubject(subject);
      if (current) {
        setQuiz(res.data);
        setQuestions(res.data.questions || []);
        setChapters(response.data);
      }
    }).catch(failure => {
      if (current) setError(failure.response?.data?.message || 'Không tải được bộ đề.');
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [id, retry]);
  function updateQuestion(index, field, value) {
    setQuestions(previous => previous.map((q, i) => i === index ? {
      ...q,
      [field]: value
    } : q));
  }
  function updateOption(index, optionIndex, value) {
    setQuestions(previous => previous.map((q, i) => {
      if (i !== index) return q;
      const options = [...q.options];
      const old = options[optionIndex];
      options[optionIndex] = value;
      return {
        ...q,
        options,
        answer: q.answer === old ? value : q.answer
      };
    }));
  }
  async function save(event) {
    event.preventDefault();
    if (pending.current || !quiz) return;
    setError('');
    if (!quiz.name?.trim() || quiz.name.trim().length > 300) {
      setError('Tên bộ đề phải có từ 1 đến 300 ký tự.');
      return;
    }
    if (!Number.isFinite(Number(quiz.timeLimit)) || Number(quiz.timeLimit) < 0) {
      setError('Thời gian làm bài phải là số không âm.');
      return;
    }
    const normalized = questions.map(q => ({
      ...q,
      question: q.question.trim(),
      options: q.options.map(o => o.trim()),
      answer: q.answer.trim(),
      image: (q.image || '').trim()
    }));
    for (let i = 0; i < normalized.length; i++) {
      const q = normalized[i];
      if (!q.question || q.options.length < 2 || q.options.some(o => !o) || new Set(q.options).size !== q.options.length || !q.options.includes(q.answer)) {
        setError(`Câu ${i + 1}: cần nội dung, ít nhất hai lựa chọn không trùng và một đáp án đúng.`);
        return;
      }
      if (q.image && !resolveAssetUrl(q.image)) {
        setError(`Câu ${i + 1}: đường dẫn ảnh không hợp lệ.`);
        return;
      }
    }
    pending.current = true;
    setSaving(true);
    try {
      await quizService.updateFull(id, {
        name: quiz.name.trim(),
        timeLimit: Number(quiz.timeLimit),
        chapterId: quiz.chapterId?._id || quiz.chapterId || null,
        questions: normalized.map(q => ({
          ...(q._id ? {
            _id: q._id
          } : {}),
          question: q.question,
          options: q.options,
          answer: q.answer,
          explain: q.explain || '',
          image: q.image
        }))
      });
      navigate(`/subject/edit/${quiz.subjectId?._id || quiz.subjectId}`);
    } catch (failure) {
      setError(failure.response?.data?.partialWrite ? 'Lưu đề gặp lỗi giữa chừng. Hãy tải lại đề để kiểm tra dữ liệu trước khi lưu lại.' : failure.response?.data?.message || 'Chưa lưu được thay đổi. Vui lòng thử lại.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  if (loading) return <p role="status" className="p-8">Đang tải bộ đề...</p>;
  if (!quiz) return <section className="p-8" role="alert"><p>{error || 'Không tìm thấy bộ đề.'}</p><button type="button" className="app-button" onClick={() => setRetry(v => v + 1)}>Thử lại</button> <Link to="/subject/edit">Về môn học</Link></section>;
  return <form className="p-8 bg-white" noValidate onSubmit={save} aria-busy={saving}><h1>Chỉnh sửa bộ đề</h1>{error && <p role="alert" className="p-4 bg-red-50 text-red-900 border border-red-700 rounded-lg">{error}</p>}{saving && <p role="status">Đang lưu bộ đề...</p>}<fieldset disabled={saving}><div className="flex gap-6 items-end flex-wrap mb-8"><label>Tên bộ đề<input className="block border rounded-lg p-2" value={quiz.name || ''} onChange={e => setQuiz(q => ({
            ...q,
            name: e.target.value
          }))} required maxLength={300} /></label><label>Chương<select className="block border rounded-lg p-2" value={quiz.chapterId?._id || quiz.chapterId || ''} onChange={e => setQuiz(q => ({
            ...q,
            chapterId: e.target.value
          }))}><option value="">Chưa chọn chương</option>{chapters.map(ch => <option key={ch._id} value={ch._id}>{ch.name}</option>)}</select></label><label>Thời gian làm bài (phút)<input type="number" min="0" className="block border rounded-lg p-2 w-28" value={quiz.timeLimit ?? 0} onChange={e => setQuiz(q => ({
            ...q,
            timeLimit: e.target.value
          }))} /></label><button type="submit" className="bg-green-800 text-white px-6 py-3 rounded-lg">Lưu thay đổi</button></div>
    {!questions.length && <p>Bộ đề chưa có câu hỏi. Bạn có thể thêm câu hỏi bên dưới.</p>}
    {questions.map((q, i) => <fieldset key={q._id || q.localId || i} className="p-6 bg-gray-50 border rounded-xl mb-6"><legend className="text-xl font-bold">Câu {i + 1}</legend><button type="button" className="text-red-900 border border-red-600 rounded p-2 mb-4" onClick={() => {
          if (window.confirm('Xóa câu hỏi này khỏi danh sách? Thay đổi chỉ được áp dụng khi lưu.')) setQuestions(previous => previous.filter((_, index) => index !== i));
        }}>Xóa câu {i + 1}</button><label className="block">Nội dung câu hỏi<input className="w-full border rounded p-2 my-2" value={q.question} onChange={e => updateQuestion(i, 'question', e.target.value)} required /></label><label className="block">Đường dẫn ảnh (tùy chọn)<input className="w-full border rounded p-2 my-2" value={q.image || ''} onChange={e => updateQuestion(i, 'image', e.target.value)} /></label>{q.image && resolveAssetUrl(q.image) && <img src={resolveAssetUrl(q.image)} alt={`Minh họa câu ${i + 1}`} className="max-w-xs max-h-64 object-contain my-4" />}<fieldset><legend className="text-base">Các lựa chọn và đáp án đúng</legend>{q.options.map((option, j) => <div className="flex items-center gap-3 my-2" key={j}><label><input type="radio" name={`correct-${q._id || q.localId || i}`} checked={Boolean(option) && option === q.answer} onChange={() => updateQuestion(i, 'answer', option)} aria-label={`Chọn lựa chọn ${j + 1} làm đáp án đúng cho câu ${i + 1}`} /></label><label className="flex-1">Lựa chọn {j + 1}<input className="w-full border rounded p-2 block" value={option} onChange={e => updateOption(i, j, e.target.value)} required /></label></div>)}</fieldset><label className="block mt-4">Giải thích<textarea className="block w-full border rounded p-2" rows={2} value={q.explain || ''} onChange={e => updateQuestion(i, 'explain', e.target.value)} /></label></fieldset>)}
    <button type="button" className="bg-green-800 text-white p-3 rounded-lg" onClick={() => setQuestions(previous => [...previous, {
        localId: crypto.randomUUID(),
        question: '',
        options: ['', '', '', ''],
        answer: '',
        explain: '',
        image: ''
      }])}>Thêm câu hỏi</button></fieldset></form>;
}
