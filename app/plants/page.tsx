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
      <AppHeader />
      <main className="mx-auto max-w-screen-xl p-4">
        {(plants ?? []).length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No plants yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(plants ?? []).map((p) => {
              const subtitle = [p.species, p.location].filter(Boolean).join(" · ");
              return (
                <Link
                  key={p.id}
                  href={`/plants/${p.id}`}
                  className="group overflow-hidden rounded-xl ring-1 ring-foreground/10 bg-card"
                >
                  <div className="relative aspect-[4/3] w-full">
                    {p.primary_photo_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoPublicUrl(p.primary_photo_path)}
                        alt={p.name}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="size-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
                        No photo
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-black/70 px-4 py-3">
                      <div className="text-base font-semibold leading-tight text-white">{p.name}</div>
                      {subtitle && (
                        <div className="text-sm text-white/75 mt-0.5">{subtitle}</div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
