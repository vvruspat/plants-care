export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 animate-in fade-in-0 slide-in-from-bottom-3 duration-300">
      {children}
    </div>
  );
}
