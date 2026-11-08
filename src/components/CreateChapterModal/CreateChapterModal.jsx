import { useEffect, useRef, useState } from 'react';
import chapterService from '../../services/chapterService';
import AccessibleDialog from '../AccessibleDialog';
export default function CreateChapterModal({
  subjectId,
  showCreateChapter,
  setShowCreateChapter
}) {
  const [chapters, setChapters] = useState([]),
    [selected, setSelected] = useState('new'),
    [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [retry, setRetry] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    if (!showCreateChapter) return;
    let current = true;
    setLoading(true);
    setError('');
    chapterService.getBySubject(subjectId).then(res => {
      if (current) setChapters(res.data);
    }).catch(() => {
      if (current) setError('Không tải được chương.');
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [subjectId, showCreateChapter, retry]);
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    setError('');
    if (selected === 'new' && !name.trim()) {
      setError('Vui lòng nhập tên chương.');
      return;
    }
    pending.current = true;
    setSaving(true);
    try {
      if (selected === 'new') await chapterService.create({
        subjectId,
        name: name.trim(),
        description: description.trim(),
        availability: true
      });else await chapterService.updateAvailability(selected, {
        availability: true
      });
      window.location.reload();
    } catch (failure) {
      setError(failure.response?.data?.message || 'Chưa lưu được chương. Vui lòng thử lại.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  if (!showCreateChapter) return null;
  return <AccessibleDialog label="Thêm chương" onClose={() => {
    if (!saving) setShowCreateChapter(false);
  }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"><form noValidate onSubmit={submit} className="w-1/2 bg-white p-8 rounded-xl"><h2>Thêm chương</h2>{loading ? <p role="status">Đang tải chương...</p> : <><label className="block">Chương cần thêm<select className="block w-full border rounded p-2 my-3" value={selected} onChange={e => setSelected(e.target.value)} disabled={saving}><option value="new">Tạo chương mới</option>{chapters.filter(c => !c.availability).map(c => <option key={c._id} value={c._id}>{c.name} (đang ẩn)</option>)}</select></label>{selected === 'new' && <><label className="block">Tên chương<input className="block w-full border rounded p-2 my-3" value={name} onChange={e => setName(e.target.value)} required disabled={saving} /></label><label className="block">Mô tả<textarea className="block w-full border rounded p-2 my-3" value={description} onChange={e => setDescription(e.target.value)} disabled={saving} /></label></>}</>}{error && <div role="alert"><p className="text-red-800">{error}</p><button type="button" onClick={() => setRetry(v => v + 1)}>Tải lại chương</button></div>}<div className="flex gap-4 mt-6"><button type="submit" disabled={saving || loading} className="bg-green-800 text-white px-6 py-2 rounded">{saving ? 'Đang lưu...' : 'Thêm'}</button><button type="button" disabled={saving} onClick={() => setShowCreateChapter(false)}>Hủy</button></div></form></AccessibleDialog>;
}
