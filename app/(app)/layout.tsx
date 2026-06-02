import { AppHeader } from "@/components/AppHeader";
import { AnimatedContent } from "@/components/AnimatedContent";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <AnimatedContent>{children}</AnimatedContent>
    </>
  );
}
