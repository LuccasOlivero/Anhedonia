import { Resend } from 'resend';

// Thin I/O wrapper around Resend's send API. Never throws — mirrors every
// other I/O module's contract in this codebase (lib/missions-sync.ts,
// lib/bond-sync.ts): wraps the external call in try/catch. Unlike those
// lazy, fire-and-forget sync modules, this function's caller (the cron
// route) needs to know per-send success/failure to build its
// { sent, skipped, failed } summary, so failure is surfaced as a returned
// { error: string } instead of only being logged.
//
// `from` uses Resend's onboarding@resend.dev sandbox sender, which requires
// zero DNS/domain setup and works immediately for any Resend account — right
// for this project's current stage, since no verified custom domain exists
// yet. Swap this constant for a verified domain address once one exists; no
// other code changes are needed.
const FROM_ADDRESS = 'Pets Forever <onboarding@resend.dev>';

export async function sendEmail(to: string, subject: string, html: string): Promise<{ error: string | null }> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('sendEmail: Resend returned an error', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (err) {
    console.error('sendEmail: unexpected error sending email', err);
    return { error: err instanceof Error ? err.message : 'Unknown error sending email.' };
  }
}
