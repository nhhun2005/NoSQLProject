import './NavBar.css';
import logo from '../../quizLogo_green.svg';
import { useSelector, useDispatch } from 'react-redux';
import { setViewMode } from '../../redux/action/viewModeAction';
import { handleLogout } from '../../redux/action/userAction';
import { Link, useNavigate } from 'react-router-dom';
import { FaUserCircle } from 'react-icons/fa';
import { useEffect, useRef, useState } from 'react';
export default function NavBar({
  selected = 'about'
}) {
  const {
    account,
    isAuthenticated
  } = useSelector(state => state.user);
  const mode = useSelector(state => state.viewMode?.mode || 'view');
  const admin = account?.role === 'Admin',
    dispatch = useDispatch(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false),
    container = useRef(null),
    toggle = useRef(null),
    first = useRef(null);
  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const closeOutside = event => {
      if (!container.current?.contains(event.target)) setOpen(false);
    };
    const escape = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const links = [{
    to: '/about',
    key: 'about',
    text: 'TRANG CHỦ'
  }, {
    to: admin ? '/subject/edit' : '/subject/view',
    key: admin ? 'chinhsuamonhoc' : 'monhoc',
    text: admin ? 'CHỈNH SỬA MÔN HỌC' : 'MÔN HỌC'
  }, {
    to: '/donggopde',
    key: 'donggopde',
    text: admin ? 'PHÊ DUYỆT ĐỀ' : 'ĐÓNG GÓP ĐỀ'
  }];
  return <nav className="quiz-nav" aria-label="Điều hướng chính"><div className="quiz-nav-left"><Link to="/about" className="quiz-nav-brand" aria-label="Project-Quizzes — Trang chủ"><img src={logo} alt="" /><span>PROJECT-QUIZZES</span></Link><div className="quiz-nav-links">{links.map(item => <Link key={item.key} to={item.to} aria-current={selected === item.key ? 'page' : undefined}>{item.text}</Link>)}</div></div><div className="quiz-nav-right">{admin && <button type="button" role="switch" aria-label="Chế độ quản trị" aria-checked={mode === 'edit'} className="quiz-mode" onClick={() => dispatch(setViewMode(mode === 'edit' ? 'view' : 'edit'))}>{mode === 'edit' ? 'Admin' : 'User'}</button>}{isAuthenticated ? <div className="quiz-account" ref={container}><button type="button" ref={toggle} className="quiz-avatar" aria-label="Mở tùy chọn tài khoản" aria-expanded={open} aria-controls="account-options" onClick={() => setOpen(v => !v)}><FaUserCircle size={36} /></button>{open && <div className="quiz-dropdown" id="account-options" aria-label="Tùy chọn tài khoản">{admin && <Link ref={first} to="/admin" onClick={() => setOpen(false)}>Trang quản trị</Link>}<button ref={admin ? undefined : first} type="button" onClick={() => {
            handleLogout(dispatch);
            setOpen(false);
            navigate('/login');
          }}>Đăng xuất</button></div>}</div> : <Link to="/login" aria-current={selected === 'dangnhap' ? 'page' : undefined} className="quiz-login">ĐĂNG NHẬP</Link>}</div></nav>;
}
