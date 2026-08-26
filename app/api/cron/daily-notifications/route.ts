import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { shouldSendDailyBonusEmail, type NotificationPreferences } from '@/lib/notifications';
import { computePeriodKey } from '@/lib/missions';
import type { PetRow } from '@/lib/pet-engine';

interface NotificationPreferenceRow {
  user_id: string;
  last_daily_bonus_email_sent_date: string | null;
}

const SUBJECT = '🎁 Tu bono diario te espera';

function buildEmailHtml(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `<div style="font-family: sans-serif; font-size: 16px; line-height: 1.5; color: #4A3222;">
  <p>¡Hola! Tu bono diario de monedas ya está disponible. Pasá a buscarlo cuando quieras 🎁</p>
  <p>
    <a
      href="${appUrl}/pet"
      style="display: inline-block; padding: 10px 24px; background-color: #8B5CF6; color: #ffffff; text-decoration: none; border-radius: 999px; font-weight: bold;"
    >
      Ir a mi mascota
    </a>
  </p>
</div>`;
}

// Vercel Cron always invokes this route with HTTP GET (see vercel.json),
// automatically sending CRON_SECRET as a Bearer token in the Authorization
// header. POST is also exposed, calling the exact same logic, purely so this
// route can be exercised manually during development with a plain curl
// -X POST — both methods enforce the same auth check below and are
// otherwise identical.
async function handleDailyNotifications(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const todayKey = computePeriodKey('daily', now);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const { data: prefsData, error: prefsError } = await supabase
    .from('notification_preferences')
    .select('user_id, last_daily_bonus_email_sent_date')
    .eq('daily_bonus_email_enabled', true);

  if (prefsError) {
    console.error('daily-notifications cron: failed to load notification preferences', prefsError);
    return NextResponse.json({ sent, skipped, failed }, { status: 200 });
  }

  const prefsRows = (prefsData ?? []) as NotificationPreferenceRow[];
  if (prefsRows.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, failed: 0 }, { status: 200 });
  }

  const userIds = prefsRows.map((row) => row.user_id);

  const { data: petsData, error: petsError } = await supabase.from('pets').select('*').in('user_id', userIds);

  if (petsError) {
    console.error('daily-notifications cron: failed to load pets', petsError);
    return NextResponse.json({ sent, skipped, failed }, { status: 200 });
  }

  const pets = (petsData ?? []) as PetRow[];
  const petByUserId = new Map(pets.map((pet) => [pet.user_id, pet]));

  const html = buildEmailHtml();

  for (const prefRow of prefsRows) {
    // A user could theoretically have opted in but have no pet yet (should
    // not happen in practice, since onboarding always creates one) — skip
    // rather than crash if the pets query returned fewer rows than user_ids.
    const pet = petByUserId.get(prefRow.user_id);
    if (!pet) {
      skipped += 1;
      continue;
    }

    const prefs: NotificationPreferences = {
      daily_bonus_email_enabled: true,
      last_daily_bonus_email_sent_date: prefRow.last_daily_bonus_email_sent_date,
    };

    if (!shouldSendDailyBonusEmail(pet, prefs, now)) {
      skipped += 1;
      continue;
    }

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(prefRow.user_id);
    if (userError || !userData?.user?.email) {
      console.error('daily-notifications cron: failed to look up user email', prefRow.user_id, userError);
      failed += 1;
      continue;
    }

    const { error: sendError } = await sendEmail(userData.user.email, SUBJECT, html);
    if (sendError) {
      console.error('daily-notifications cron: failed to send email', prefRow.user_id, sendError);
      failed += 1;
      continue;
    }

    // The email genuinely went out — count it as sent even if the
    // status-update write below fails. A failed status-update risks a
    // duplicate email on the next cron run, which is an accepted, documented
    // limitation, not a crash.
    sent += 1;

    const { error: updateError } = await supabase
      .from('notification_preferences')
      .update({ last_daily_bonus_email_sent_date: todayKey })
      .eq('user_id', prefRow.user_id);

    if (updateError) {
      console.error(
        'daily-notifications cron: email sent but failed to update last_daily_bonus_email_sent_date',
        prefRow.user_id,
        updateError
      );
    }
  }

  return NextResponse.json({ sent, skipped, failed }, { status: 200 });
}

export async function GET(request: NextRequest) {
  return handleDailyNotifications(request);
}

export async function POST(request: NextRequest) {
  return handleDailyNotifications(request);
}
