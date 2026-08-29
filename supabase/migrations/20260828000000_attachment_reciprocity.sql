-- supabase/migrations/20260828000000_attachment_reciprocity.sql
alter table pets add column if not exists last_streak_milestone_claimed smallint not null default 0;

alter table notification_preferences add column if not exists streak_surprise_email_enabled boolean not null default false;
alter table notification_preferences add column if not exists last_streak_surprise_email_sent_date date;
