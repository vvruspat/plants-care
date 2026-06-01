import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { photoPublicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function PlantsListPage() {
  const supabase = await createSupabaseServerClient();
  const { data: plants } = await supabase
    .from("plants")
    .select("id, name, species, location, primary_photo_path")
    .order("created_at", { ascending: false });

  return (
    <div className="flex-1">
      <AppHeader title="All Plants" />
      <main className="mx-auto max-w-md p-4 space-y-2">
        {(plants ?? []).map((p) => (
          <Link
            key={p.id}
            href={`/plants/${p.id}`}
            className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent"
          >
            <div className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
              {p.primary_photo_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPublicUrl(p.primary_photo_path)} alt={p.name} className="size-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium">{p.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {[p.species, p.location].filter(Boolean).join(" · ") || "No details"}
              </div>
            </div>
          </Link>
        ))}
        {(plants ?? []).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No plants yet.</p>
        )}
      </main>
    </div>
  );
}
