import { useState, useRef } from 'react';
import subjectService from '../../services/subjectService';
import AccessibleDialog from '../AccessibleDialog';
import { resolveAssetUrl } from '../../utils/apiConfig';
export default function CreateSubjectModal({
  setShowCreateSubjectModal
}) {
  const [name, setName] = useState(''),
    [image, setImage] = useState(''),
    [description, setDescription] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    setError('');
    if (!name.trim()) {
      setError('Vui lòng nhập tên môn học.');
      return;
    }
    if (image.trim() && !resolveAssetUrl(image)) {
      setError('Đường dẫn ảnh không hợp lệ.');
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      await subjectService.create({
        name: name.trim(),
        image: image.trim(),
        description: description.trim(),
        availability: true
      });
      window.location.reload();
    } catch (failure) {
      setError(failure.response?.data?.message || 'Chưa tạo được môn học. Vui lòng thử lại.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return <AccessibleDialog label="Tạo môn học mới" onClose={() => {
    if (!busy) setShowCreateSubjectModal(false);
  }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"><form noValidate className="w-1/2 bg-white p-8 rounded-xl" onSubmit={submit} aria-busy={busy}><h2>Tạo môn học mới</h2><fieldset disabled={busy}><label className="block">Tên môn học<input className="block border rounded p-2 w-full my-3" value={name} onChange={e => setName(e.target.value)} required /></label><label className="block">Đường dẫn ảnh<input className="block border rounded p-2 w-full my-3" value={image} onChange={e => setImage(e.target.value)} /></label><label className="block">Mô tả môn học<textarea className="block border rounded p-2 w-full my-3" value={description} onChange={e => setDescription(e.target.value)} /></label>{error && <p role="alert" className="text-red-800">{error}</p>}<div className="flex gap-4 mt-6"><button type="submit" className="bg-green-800 text-white p-3 rounded">{busy ? 'Đang tạo...' : 'Thêm môn học'}</button><button type="button" className="app-button app-button--secondary" onClick={() => setShowCreateSubjectModal(false)}>Hủy bỏ</button></div></fieldset></form></AccessibleDialog>;
}
