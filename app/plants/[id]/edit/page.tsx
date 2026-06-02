import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { PageWrapper } from "@/components/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { updatePlant } from "@/app/actions/plants";

export const dynamic = "force-dynamic";

export default async function EditPlantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: plant } = await supabase
    .from("plants")
    .select("id, name, species, location, notes")
    .eq("id", id)
    .single();
  if (!plant) notFound();

  async function save(formData: FormData) {
    "use server";
    await updatePlant(id, {
      name: String(formData.get("name") ?? ""),
      species: (formData.get("species") as string) || null,
      location: (formData.get("location") as string) || null,
      notes: (formData.get("notes") as string) || null,
    });
    redirect(`/plants/${id}`);
  }

  return (
    <PageWrapper>
      <AppHeader />
      <main className="mx-auto max-w-md p-4">
        <form action={save} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input name="name" defaultValue={plant.name} required />
          </div>
          <div className="space-y-1.5">
            <Label>Species</Label>
            <Input name="species" defaultValue={plant.species ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input name="location" defaultValue={plant.location ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea name="notes" defaultValue={plant.notes ?? ""} rows={4} />
          </div>
          <Button type="submit" className="w-full">Save</Button>
        </form>
      </main>
    </PageWrapper>
  );
}
