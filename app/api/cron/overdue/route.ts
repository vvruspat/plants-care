import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { postToSlack } from "@/lib/slack";

export const runtime = "nodejs";

type OverdueRow = {
  id: string;
  label: string;
  kind: "water" | "fertilize" | "custom";
  next_due_at: string;
  plant: { id: string; name: string; location: string | null } | null;
};

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from("care_schedules")
    .select("id, label, kind, next_due_at, plant:plants(id, name, location)")
    .eq("active", true)
    .lt("next_due_at", new Date().toISOString())
    .returns<OverdueRow[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (rows ?? []).map((r) => r.id);
  const { data: alreadyNotified } = await supabase
    .from("slack_notifications")
    .select("schedule_id")
    .eq("notified_on", today)
    .in("schedule_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const skipSet = new Set((alreadyNotified ?? []).map((r) => r.schedule_id));

  const fresh = (rows ?? []).filter((r) => !skipSet.has(r.id) && r.plant);
  if (fresh.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  if (!process.env.SLACK_WEBHOOK_URL) {
    return NextResponse.json({
      ok: true,
      notified: 0,
      skipped: fresh.length,
      reason: "SLACK_WEBHOOK_URL not configured",
    });
  }

  const lines = fresh.map((r) => {
    const days = Math.floor((Date.now() - new Date(r.next_due_at).getTime()) / 86_400_000);
    const where = r.plant?.location ? ` (${r.plant.location})` : "";
    return `• *${r.plant?.name}*${where} — ${r.label} overdue by ${days}d`;
  });

  await postToSlack({
    text: `🌿 Plant care overdue: ${fresh.length} item${fresh.length === 1 ? "" : "s"}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `🌿 *Plant care overdue* (${fresh.length})\n${lines.join("\n")}` },
      },
    ],
  });

  await supabase
    .from("slack_notifications")
    .insert(fresh.map((r) => ({ schedule_id: r.id, notified_on: today })));

  return NextResponse.json({ ok: true, notified: fresh.length });
}
