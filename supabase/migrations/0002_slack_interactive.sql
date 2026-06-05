-- Store message_ts so we can update/thread Slack messages later.
alter table public.slack_notifications
  add column if not exists message_ts text,
  add column if not exists channel_id  text;

-- Also widen the cron to include near-due (not just overdue) by removing
-- the hard-coded date check — handled in application code now.
