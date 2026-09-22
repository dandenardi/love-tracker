import { Resend } from 'resend';

// Constructed lazily (not at module load) so importing this file never crashes in contexts
// where RESEND_API_KEY isn't set (e.g. tests that don't exercise the email-sending path).
let resend: Resend | null = null;
function getClient(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = process.env.EMAIL_FROM as string;

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await getClient().emails.send({
    from: FROM,
    to,
    subject: 'Reset your Love Tracker password',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #E94B77;">Reset your password</h2>
        <p>We received a request to reset the password for your Love Tracker account.</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; background: #E94B77; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Reset Password
          </a>
        </p>
        <p>This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}
