import Link from "next/link";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { PageWrapper } from "@/components/PageWrapper";
import { PlantCard, type FeedPlant, type FeedSchedule } from "@/components/PlantCard";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type ScheduleRow = {
  id: string;
  kind: "water" | "fertilize" | "custom";
  label: string;
  next_due_at: string;
  last_done_at: string | null;
  last_done_by: string | null;
  plant: {
    id: string;
    name: string;
    primary_photo_path: string | null;
    species: string | null;
    location: string | null;
  } | null;
};

async function resolveDisplayNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  try {
    const admin = createSupabaseServiceClient();
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const u of data?.users ?? []) {
      if (!ids.includes(u.id)) continue;
      const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
      map.set(u.id, meta.full_name ?? meta.name ?? (u.email?.split("@")[0] ?? "someone"));
    }
  } catch {
    // service role not configured; names will be omitted gracefully
  }
  return map;
}

export default async function Home() {
  const supabase = await createSupabaseServerClient();

  // Fetch all active schedules for all plants, ordered by urgency.
  // Plants are sorted by their most urgent action (earliest next_due_at).
  const { data: rows } = await supabase
    .from("care_schedules")
    .select(
      "id, kind, label, next_due_at, last_done_at, last_done_by, plant:plants(id, name, primary_photo_path, species, location)",
    )
    .eq("active", true)
    .order("next_due_at", { ascending: true })
    .returns<ScheduleRow[]>();

  const userIds = Array.from(
    new Set((rows ?? []).map((r) => r.last_done_by).filter((v): v is string => Boolean(v))),
  );
  const nameMap = await resolveDisplayNames(userIds);

  // Group schedules by plant. Because rows are ordered by next_due_at,
  // the first time we encounter a plant it carries its most urgent action,
  // so Map insertion order gives us plants sorted by urgency for free.
  const grouped = new Map<string, FeedPlant>();
  for (const r of rows ?? []) {
    if (!r.plant) continue;
    const existing = grouped.get(r.plant.id) ?? {
      id: r.plant.id,
      name: r.plant.name,
      primary_photo_path: r.plant.primary_photo_path,
      species: r.plant.species,
      location: r.plant.location,
      schedules: [] as FeedSchedule[],
    };
    existing.schedules.push({
      id: r.id,
      kind: r.kind,
      label: r.label,
      next_due_at: r.next_due_at,
      last_done_at: r.last_done_at,
      last_done_by_name: r.last_done_by ? nameMap.get(r.last_done_by) ?? null : null,
    });
    grouped.set(r.plant.id, existing);
  }
  const plants = Array.from(grouped.values());

  return (
    <PageWrapper>
      <AppHeader />
      <main className="mx-auto max-w-screen-xl p-4">
        {plants.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {plants.map((p) => <PlantCard key={p.id} plant={p} />)}
          </div>
        )}
      </main>
    </PageWrapper>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
      <div className="text-3xl">🌱</div>
      <p className="text-sm text-muted-foreground">No plants yet. Add your first one!</p>
      <Button asChild>
        <Link href="/plants/new">Add a plant</Link>
      </Button>
    </div>
  );
}
