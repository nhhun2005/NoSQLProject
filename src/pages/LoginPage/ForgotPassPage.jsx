import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import { AuthLayout, AuthField } from '../../components/AuthForm';
import { safeReturnTo, validEmail } from '../../utils/authValidation';
export default function ForgotPassPage() {
  const [email, setEmail] = useState(''),
    [otp, setOtp] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('');
  const [step, setStep] = useState(1),
    [errors, setErrors] = useState({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [cooldown, setCooldown] = useState(0);
  const pending = useRef(false),
    navigate = useNavigate(),
    location = useLocation(),
    from = safeReturnTo(location.state?.from);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(v => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function send() {
    await authService.forgotPassword({
      email: email.trim().toLowerCase()
    });
    setOtp('');
    setStep(2);
    setCooldown(30);
  }
  async function perform(action) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      if (failure.response?.data?.status === 'banned') navigate('/banned');else setError(failure.response?.data?.message || 'Không thể kết nối. Vui lòng thử lại.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function submit(event) {
    event.preventDefault();
    const next = {};
    setError('');
    if (step === 1) {
      if (!validEmail(email)) next.email = 'Vui lòng nhập email hợp lệ.';
    } else if (!/^\d{6}$/.test(otp)) next.otp = 'Vui lòng nhập đủ 6 chữ số OTP.';
    if (step === 3) {
      if (password.length < 6) next.password = 'Mật khẩu phải có ít nhất 6 ký tự.';
      if (!confirm) next.confirm = 'Vui lòng xác nhận mật khẩu.';else if (confirm !== password) next.confirm = 'Mật khẩu xác nhận không trùng khớp.';
    }
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`forgot-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    perform(async () => {
      if (step === 1) await send();else if (step === 2) {
        await authService.verifyForgotOtp({
          email: email.trim().toLowerCase(),
          otp
        });
        setStep(3);
      } else {
        await authService.resetPassword({
          email: email.trim().toLowerCase(),
          otp,
          newPassword: password
        });
        setPassword('');
        setConfirm('');
        setOtp('');
        setStep(4);
      }
    });
  }
  return <AuthLayout title="Quên mật khẩu">{step === 4 ? <div className="auth-success" role="status"><p>Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.</p><Link to="/login" state={{
        from
      }}>Đăng nhập</Link></div> : <><p className="auth-step">Bước {step}/3 · {step === 1 ? 'Nhập email' : step === 2 ? 'Xác minh OTP' : 'Đặt mật khẩu mới'}</p><form noValidate onSubmit={submit} aria-busy={busy}>{step === 1 ? <AuthField id="forgot-email" label="Email tài khoản" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required error={errors.email} /> : <p>Email: <strong>{email.trim()}</strong></p>}{step === 2 && <AuthField id="forgot-otp" label="Mã OTP" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required error={errors.otp} />} {step === 3 && <><AuthField id="forgot-password" label="Mật khẩu mới (ít nhất 6 ký tự)" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required error={errors.password} /><AuthField id="forgot-confirm" label="Xác nhận mật khẩu mới" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required error={errors.confirm} /></>}{error && <p className="auth-error" role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy ? 'Đang xử lý...' : step === 1 ? 'Gửi mã xác thực' : step === 2 ? 'Xác thực OTP' : 'Cập nhật mật khẩu'}</button></form>{step > 1 && <><button type="button" className="auth-link" disabled={busy || cooldown > 0} onClick={() => perform(send)}>{cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : 'Gửi lại mã OTP'}</button><button type="button" className="auth-link auth-foot" disabled={busy} onClick={() => {
          setStep(1);
          setOtp('');
          setPassword('');
          setConfirm('');
          setErrors({});
          setError('');
        }}>Sửa địa chỉ email</button></>}</>}<p className="auth-foot"><Link to="/login" state={{
        from
      }}>Quay lại đăng nhập</Link></p></AuthLayout>;
}
