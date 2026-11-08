import { useState } from 'react';
import logo from '../quizLogo_green.svg';
import '../pages/LoginPage/LoginPage.css';
export function AuthLayout({
  title,
  children
}) {
  return <div className="auth-screen"><div className="auth-card"><aside className="auth-brand"><img src={logo} alt="Project-Quizzes" /><p>Project-Quizzes</p></aside><section className="auth-content" aria-labelledby="auth-title"><h1 id="auth-title">{title}</h1>{children}</section></div></div>;
}
export function AuthField({
  id,
  label,
  error,
  type = 'text',
  ...props
}) {
  const [shown, setShown] = useState(false);
  const password = type === 'password';
  return <div className="auth-field"><label htmlFor={id}>{label}</label><div className="auth-input-row"><input {...props} id={id} type={password && shown ? 'text' : type} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />{password && <button type="button" className="auth-eye" aria-label={shown ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`} aria-pressed={shown} onClick={() => setShown(v => !v)}>{shown ? 'Ẩn' : 'Hiện'}</button>}</div>{error && <p id={`${id}-error`} className="auth-field-error">{error}</p>}</div>;
}
