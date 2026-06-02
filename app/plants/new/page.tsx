import { AppHeader } from "@/components/AppHeader";
import { PageWrapper } from "@/components/PageWrapper";
import { NewPlantForm } from "./form";

export default function NewPlantPage() {
  return (
    <PageWrapper>
      <AppHeader />
      <main className="mx-auto max-w-md p-4">
        <NewPlantForm />
      </main>
    </PageWrapper>
  );
}
