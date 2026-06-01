# 🌿 Office Plant Care

Mobile-first web app for the Coolset office to track plant care. Built on Next.js + shadcn/ui + Supabase + Anthropic + Slack, deployed on Vercel.

## Features

- Google sign-in restricted to `@coolset.com` accounts
- Add plants with a photo — Claude identifies the plant and suggests a watering/fertilizing schedule
- Custom recurring or one-off care actions
- Main feed shows what's due in the next 24 hours; tap **Done** to log it (last-done-by attribution)
- Check-in photos go to Claude for a quick condition review; urgent recommendations become one-off action items
- Daily Vercel Cron at 09:00 UTC posts overdue items to a Slack channel via webhook

## Setup

1. **Install deps**
   ```bash
   npm install
   ```

2. **Create a Supabase project** and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) in the SQL editor. Enable the Google OAuth provider in Authentication → Providers (use a Google Cloud OAuth client whose authorized redirect URIs include `<supabase-url>/auth/v1/callback`).

3. **Create a Slack incoming webhook** pointing at `#feed-pants-care` (or whichever channel should receive overdue notifications).

4. **Copy `.env.example` → `.env.local`** and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — server only, used by the cron route and to resolve display names
   - `ANTHROPIC_API_KEY`
   - `SLACK_WEBHOOK_URL`
   - `CRON_SECRET` — any long random string; Vercel Cron will send it as the bearer token

5. **Run locally**
   ```bash
   npm run dev
   ```

## Deploy to Vercel

```bash
vercel link
vercel env add # for each variable above
vercel deploy --prod
```

`vercel.json` registers the daily cron. To test the cron locally:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/overdue
```

## Architecture

- **Next.js App Router** with server components for reads and server actions for writes
- **Supabase**: Postgres + Auth + Storage; RLS enforces "must be authenticated", a trigger on `auth.users` blocks non-coolset emails
- **Anthropic Claude** (`claude-sonnet-4-6`) with vision via `image.source.type = "url"` pointing at the public Supabase Storage URL
- **Slack** incoming webhook with daily de-duplication via `slack_notifications` table

## File map

- `supabase/migrations/0001_init.sql` — schema, RLS, domain trigger, storage bucket
- `middleware.ts` — single auth gate
- `app/page.tsx` — main feed (≤24h due)
- `app/plants/*` — list, new, detail, edit
- `app/actions/*` — server actions (plants, care, photos)
- `app/api/cron/overdue/route.ts` — Slack cron
- `lib/anthropic.ts` — typed Claude prompts (zod-validated output)
- `lib/scheduling.ts` — next-due math
- `lib/slack.ts` — webhook poster
