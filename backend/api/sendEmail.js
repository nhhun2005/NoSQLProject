import { Resend } from 'resend';

// Never print email addresses, OTPs, provider payloads or credentials to logs.
// Delivery failure must reach the caller rather than claim an OTP was sent.
export async function sendVerificationEmail(to, otp) {
  if (!process.env.RESEND_API_KEY) throw new Error('Email delivery is not configured');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const escapedEmail = String(to).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
  const code = String(otp);
  if (!/^\d{6}$/.test(code)) throw new Error('Invalid verification code');
  const response = await resend.emails.send({
    from: 'Project-Quizzes <noreply@nhhun2005.id.vn>',
    to: [to],
    subject: 'Mã xác minh Project-Quizzes',
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#173c32;max-width:600px;margin:auto;padding:24px"><h1>Xác minh yêu cầu của bạn</h1><p>Bạn vừa yêu cầu xác minh tài khoản hoặc đặt lại mật khẩu cho <strong>${escapedEmail}</strong>.</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px">${code}</p><p>Mã có hiệu lực trong 10 phút. Không chia sẻ mã với người khác.</p><p>Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p><p>Project-Quizzes</p></div>`,
    text: `Mã xác minh Project-Quizzes của bạn: ${code}. Mã có hiệu lực trong 10 phút. Không chia sẻ mã với người khác. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.`
  });
  if (response.error) throw new Error('Email delivery failed');
  return {
    success: true
  };
}
export default sendVerificationEmail;
