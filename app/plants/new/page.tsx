import { AppHeader } from "@/components/AppHeader";
import { NewPlantForm } from "./form";

export default function NewPlantPage() {
  return (
    <div className="flex-1">
      <AppHeader title="Add Plant" />
      <main className="mx-auto max-w-md p-4">
        <NewPlantForm />
      </main>
    </div>
  );
}
