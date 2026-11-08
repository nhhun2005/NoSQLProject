import { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import authService from '../../services/authService';
import { AuthLayout, AuthField } from '../../components/AuthForm';
import { safeReturnTo, validEmail } from '../../utils/authValidation';
export default function RegisterPage() {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [otp, setOtp] = useState('');
  const [step, setStep] = useState('register'),
    [errors, setErrors] = useState({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const pending = useRef(false),
    location = useLocation(),
    from = safeReturnTo(location.state?.from);
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const next = {};
    setError('');
    if (step === 'register') {
      if (!email.trim()) next.email = 'Vui lòng nhập email.';else if (!validEmail(email)) next.email = 'Email chưa đúng định dạng.';
      if (password.length < 6) next.password = 'Mật khẩu phải có ít nhất 6 ký tự.';
      if (!confirm) next.confirm = 'Vui lòng xác nhận mật khẩu.';else if (confirm !== password) next.confirm = 'Mật khẩu xác nhận không trùng khớp.';
    } else if (!/^\d{6}$/.test(otp)) next.otp = 'Vui lòng nhập đủ 6 chữ số OTP.';
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`register-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      if (step === 'register') {
        await authService.register({
          email: email.trim().toLowerCase(),
          password
        });
        setStep('otp');
      } else {
        await authService.verifyOTP({
          email: email.trim().toLowerCase(),
          otp
        });
        setStep('done');
        setPassword('');
        setConfirm('');
        setOtp('');
      }
    } catch (failure) {
      setError(failure.response?.data?.message || 'Không thể kết nối. Vui lòng thử lại.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return <AuthLayout title="Đăng ký tài khoản">{step === 'done' ? <div className="auth-success" role="status"><p>Tài khoản đã được xác minh.</p><Link to="/login" state={{
        from
      }}>Đăng nhập để tiếp tục</Link></div> : <form noValidate onSubmit={submit} aria-busy={busy}>{step === 'register' ? <><AuthField id="register-email" label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required error={errors.email} /><AuthField id="register-password" label="Mật khẩu (ít nhất 6 ký tự)" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required error={errors.password} /><AuthField id="register-confirm" label="Xác nhận mật khẩu" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required error={errors.confirm} /></> : <><p>Mã xác minh đã được gửi đến <strong>{email.trim()}</strong>. Kiểm tra cả thư mục spam.</p><AuthField id="register-otp" label="Mã OTP" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required error={errors.otp} /><button type="button" className="auth-link" disabled={busy} onClick={() => {
          setStep('register');
          setErrors({});
          setError('');
        }}>Sửa email / gửi lại mã</button></>}{error && <p className="auth-error" role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy ? 'Đang xử lý...' : step === 'register' ? 'Gửi mã xác minh' : 'Xác nhận mã OTP'}</button></form>}<p className="auth-foot">Đã có tài khoản? <Link to="/login" state={{
        from
      }}>Đăng nhập</Link></p></AuthLayout>;
}
