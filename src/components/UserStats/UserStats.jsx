import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import submissionService from '../../services/submissionService';
import { summarizeProgress } from '../../utils/progressStats';
export default function UserStats({
  userId,
  subjectId,
  chapters
}) {
  const [submissions, setSubmissions] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setError('');
    setSubmissions([]);
    if (!userId || !subjectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    submissionService.getBySubject(userId, subjectId).then(res => {
      if (current) setSubmissions(res.data);
    }).catch(() => {
      if (current) setError('Không tải được thống kê.');
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [userId, subjectId, retry]);
  const {
    data,
    completed,
    overall
  } = useMemo(() => summarizeProgress(chapters, submissions), [chapters, submissions]);
  if (loading) return <p role="status">Đang tải thống kê...</p>;
  if (error) return <div role="alert"><p>{error}</p><button type="button" className="app-button" onClick={() => setRetry(v => v + 1)}>Thử lại thống kê</button></div>;
  if (!chapters?.length) return <p>Môn học chưa có chương được công khai.</p>;
  if (!completed) return <p>Chưa có dữ liệu bài làm có tính điểm. Kết quả luyện tập không được lưu vào thống kê.</p>;
  const lower = data.filter(item => item.avg !== null && item.avg < 60).map(item => item.name);
  return <section aria-labelledby="progress-heading"><h2 id="progress-heading" className="text-xl font-semibold text-green-900">Kết quả ôn tập</h2><p>Trung bình điểm cao nhất của {completed} đề đã làm: <strong>{overall}%</strong>.</p><p className="text-gray-700">Mỗi đề đã làm có trọng số như nhau. Đề chưa làm không tính là 0 điểm. Chỉ số này không thay thế điểm học phần.</p><div className="w-full h-[350px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{
          top: 20,
          right: 20,
          left: 10,
          bottom: 20
        }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[0, 100]} /><Tooltip formatter={value => [`${value}%`, 'Trung bình điểm cao nhất']} /><ReferenceLine y={90} stroke="#854d0e" strokeDasharray="4 4" label="Mốc luyện tập 90%" /><Bar dataKey="avg" fill="#286b3c" name="Trung bình điểm cao nhất" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div><ul>{data.map(chapter => <li key={chapter.id}>{chapter.name}: {chapter.avg === null ? 'Chưa có bài làm' : `${chapter.avg}% (${chapter.completed}/${chapter.total} đề đã làm)`}</li>)}</ul><p>{lower.length ? `Bạn có thể ưu tiên ôn lại: ${lower.join(', ')}.` : 'Bạn có thể tiếp tục luyện những phần chưa làm để có đánh giá đầy đủ hơn.'}</p></section>;
}
