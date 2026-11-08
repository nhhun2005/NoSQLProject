import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser } from '../../redux/action/userAction';
import { AuthLayout, AuthField } from '../../components/AuthForm';
import { safeReturnTo, validEmail } from '../../utils/authValidation';
export default function LoginPage() {
  const [identifier, setIdentifier] = useState(''),
    [password, setPassword] = useState('');
  const [errors, setErrors] = useState({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const pending = useRef(false),
    dispatch = useDispatch(),
    navigate = useNavigate(),
    location = useLocation();
  const isAuthenticated = useSelector(state => state.user.isAuthenticated);
  const from = safeReturnTo(location.state?.from);
  useEffect(() => {
    if (isAuthenticated) navigate(from, {
      replace: true
    });
  }, [isAuthenticated, from, navigate]);
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const next = {};
    if (!identifier.trim()) next.identifier = 'Vui lòng nhập email hoặc tên đăng nhập.';else if (identifier.includes('@') && !validEmail(identifier)) next.identifier = 'Email chưa đúng định dạng.';
    if (!password) next.password = 'Vui lòng nhập mật khẩu.';
    setErrors(next);
    setError('');
    if (Object.keys(next).length) {
      document.getElementById(next.identifier ? 'login-identifier' : 'login-password')?.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const value = identifier.trim();
      const result = await dispatch(loginUser({
        username: value.includes('@') ? undefined : value,
        email: value.includes('@') ? value : undefined,
        password
      }));
      if (result?.status === 'banned') navigate('/banned');else if (!result?.accessToken) setError('Không thể đăng nhập. Vui lòng thử lại.');
    } catch (failure) {
      setError(failure.response?.data?.message || 'Không thể kết nối. Vui lòng thử lại.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return <AuthLayout title="Đăng nhập"><form noValidate onSubmit={submit} aria-busy={busy}><AuthField id="login-identifier" label="Email hoặc tên đăng nhập" value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="username" required error={errors.identifier} /><AuthField id="login-password" label="Mật khẩu" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required error={errors.password} />{error && <p className="auth-error" role="alert">{error}</p>}<Link to="/forgot-password" state={{
        from
      }}>Quên mật khẩu?</Link><button type="submit" disabled={busy}>{busy ? 'Đang đăng nhập...' : 'Đăng nhập'}</button></form><p className="auth-foot">Chưa có tài khoản? <Link to="/register" state={{
        from
      }}>Đăng ký ngay</Link></p></AuthLayout>;
}
