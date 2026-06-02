import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { PageWrapper } from "@/components/PageWrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dueLabel } from "@/lib/scheduling";
import { photoPublicUrl } from "@/lib/storage";
import { CheckinPhotoButton } from "./checkin";
import { DeletePlantButton } from "./delete";
import { ScheduleManager } from "./schedules";

export const dynamic = "force-dynamic";

export default async function PlantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: plant } = await supabase
    .from("plants")
    .select("id, name, species, location, notes, primary_photo_path, ai_care_summary, created_at")
    .eq("id", id)
    .single();
  if (!plant) notFound();

  const { data: schedules } = await supabase
    .from("care_schedules")
    .select("id, kind, label, interval_days, next_due_at, last_done_at, last_done_by, active")
    .eq("plant_id", id)
    .eq("active", true)
    .order("next_due_at");

  const { data: photos } = await supabase
    .from("plant_photos")
    .select("id, storage_path, taken_at, ai_analysis, uploaded_by")
    .eq("plant_id", id)
    .order("taken_at", { ascending: false })
    .limit(8);

  const userIds = Array.from(
    new Set(
      [
        ...(schedules ?? []).map((s) => s.last_done_by),
        ...(photos ?? []).map((p) => p.uploaded_by),
      ].filter((v): v is string => Boolean(v)),
    ),
  );
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    try {
      const admin = createSupabaseServiceClient();
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      for (const u of data?.users ?? []) {
        if (!userIds.includes(u.id)) continue;
        const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
        names.set(u.id, meta.full_name ?? meta.name ?? (u.email?.split("@")[0] ?? "someone"));
      }
    } catch {}
  }

  return (
    <PageWrapper>
      <AppHeader />
      <main className="mx-auto max-w-md p-4 space-y-4">
        {plant.primary_photo_path && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPublicUrl(plant.primary_photo_path)}
            alt={plant.name}
            className="aspect-[4/3] w-full rounded-lg object-cover"
          />
        )}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{plant.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[plant.species, plant.location].filter(Boolean).join(" · ") || "—"}
          </p>
          {plant.ai_care_summary && (
            <p className="text-sm rounded-md bg-muted p-2 mt-2">{plant.ai_care_summary}</p>
          )}
          {plant.notes && <p className="text-sm mt-2">{plant.notes}</p>}
        </div>

        <div className="flex gap-2">
          <CheckinPhotoButton plantId={plant.id} />
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/plants/${plant.id}/edit`}>Edit</Link>
          </Button>
          <DeletePlantButton plantId={plant.id} />
        </div>

        <ScheduleManager
          plantId={plant.id}
          schedules={(schedules ?? []).map((s) => ({
            ...s,
            last_done_by_name: s.last_done_by ? names.get(s.last_done_by) ?? null : null,
          }))}
        />

        <Card>
          <CardHeader><CardTitle className="text-base">Recent photos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(photos ?? []).length === 0 && <p className="text-sm text-muted-foreground">No photos yet.</p>}
            {(photos ?? []).map((p) => {
              const a = p.ai_analysis as { condition?: string; observations?: string[] } | null;
              return (
                <div key={p.id} className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPublicUrl(p.storage_path)} alt="" className="size-20 rounded-md object-cover" />
                  <div className="min-w-0 text-sm">
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.taken_at).toLocaleString()}
                      {p.uploaded_by && names.get(p.uploaded_by) && ` · ${names.get(p.uploaded_by)}`}
                    </div>
                    {a?.condition && <Badge variant="outline" className="mt-1">{a.condition}</Badge>}
                    {a?.observations && a.observations.length > 0 && (
                      <ul className="mt-1 text-xs text-muted-foreground list-disc list-inside">
                        {a.observations.slice(0, 2).map((o, i) => <li key={i}>{o}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center pb-4">
          Dueness: {schedules?.map((s) => `${s.label}: ${dueLabel(s.next_due_at).text}`).join(" · ")}
        </p>
      </main>
    </PageWrapper>
  );
}
