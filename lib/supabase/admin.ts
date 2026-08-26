import { createClient } from '@supabase/supabase-js';

// Service-role Supabase client — bypasses Row Level Security entirely.
//
// SECURITY: this client must NEVER be imported by anything reachable from a
// Server Action, a Client Component, or any user-facing request path. It
// exists solely for app/api/cron/daily-notifications/route.ts, a trusted
// backend job with no logged-in user, which needs to read across every
// user's notification_preferences/pets rows and look up emails via
// supabase.auth.admin.getUserById — both impossible through the normal
// session-scoped client in lib/supabase/server.ts, since every RLS policy in
// this app is scoped to auth.uid() = user_id and a cron request authenticates
// as nobody. SUPABASE_SERVICE_ROLE_KEY is a strictly more powerful credential
// than anything else in this app: a leak bypasses every RLS policy on every
// table. Keep its use confined to that one route.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
